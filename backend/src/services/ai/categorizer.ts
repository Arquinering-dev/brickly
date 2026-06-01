/**
 * Clasificador de insumos por categoría usando Gemini.
 *
 * Asigna a cada insumo una categoría canónica según QUÉ ES / a qué rubro o gremio pertenece,
 * leyendo su descripción + tipo. Corre en write-time (al importar una obra, o vía backfill),
 * y el resultado se persiste en Insumo.categoriaCanonica. La vista de proyección solo lee ese
 * campo — no hay IA en vivo por request.
 *
 * Si GEMINI_API_KEY no está configurada, categorizeInsumos devuelve un Map vacío (no-op).
 */
import { geminiGenerateJson, isGeminiConfigured } from "./gemini.client";
import prisma from "../../prisma/client";

export type InsumoParaCategorizar = {
  codigo: string;
  descripcion: string;
  tipo: string; // MATERIAL | MANO_DE_OBRA | EQUIPO | SUBCONTRATO
  unidad?: string;
  categoria?: string | null; // categoría cruda del Excel, como pista
};

/**
 * Vocabulario sugerido (no cerrado). Gemini prefiere estas; si ninguna describe bien al insumo,
 * puede proponer una categoría corta y clara. Pensado para construcción (Argentina).
 */
const CATEGORIAS_SUGERIDAS = {
  MATERIAL: [
    "Corralón", "Acero", "Hormigón", "Áridos", "Cemento y aglomerantes",
    "Mampostería y bloques", "Aislaciones", "Impermeabilización", "Pinturas",
    "Revestimientos y cerámicos", "Aberturas y carpintería", "Eléctricos",
    "Sanitarios y agua", "Gas", "Climatización y calefacción", "Durlock y construcción en seco",
    "Maderas", "Yeso y cielorrasos", "Vidrios", "Herrería y metalúrgica", "Ferretería",
  ],
  MANO_DE_OBRA: [
    "UOCRA", "Oficiales y ayudantes", "Mano de obra especializada",
    "Electricistas", "Sanitaristas", "Pintores", "Yeseros", "Herreros",
  ],
  EQUIPO: ["Equipos y maquinaria", "Andamios y encofrados", "Transporte y logística"],
  SUBCONTRATO: [
    "Estructura", "Movimiento de suelos", "Instalación eléctrica", "Instalación sanitaria",
    "Instalación de gas", "Climatización", "Pintura", "Impermeabilización",
    "Cerramientos y aberturas", "Pisos y revestimientos", "Ascensores", "Ensayos y certificaciones",
  ],
} as const;

const MAX_LEN = 40;

/** Normaliza la categoría devuelta por el modelo (trim, colapsar espacios, cap de longitud). */
function normalizeCategoria(raw: string | null | undefined): string {
  const s = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!s) return "Otros";
  return s.length > MAX_LEN ? s.slice(0, MAX_LEN).trim() : s;
}

const BATCH = 40;

/**
 * Clasifica una lista de insumos. Devuelve Map<codigo, categoriaCanonica>.
 * Procesa en lotes; si un lote falla, lo saltea (best-effort) y sigue con los demás.
 */
export async function categorizeInsumos(
  insumos: InsumoParaCategorizar[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!isGeminiConfigured() || insumos.length === 0) return out;

  const sugeridasTexto = Object.entries(CATEGORIAS_SUGERIDAS)
    .map(([tipo, cats]) => `  ${tipo}: ${cats.join(", ")}`)
    .join("\n");

  const system =
    "Sos un asistente experto en construcción de obra (Argentina). Clasificás insumos de obra " +
    "(materiales, mano de obra, equipos y subcontratos) en una categoría que describe a qué " +
    "rubro o gremio pertenece el insumo, según su descripción. Respondé SIEMPRE en español.";

  const responseSchema = {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            codigo: { type: "string" },
            categoria: { type: "string" },
          },
          required: ["codigo", "categoria"],
        },
      },
    },
    required: ["items"],
  };

  for (let i = 0; i < insumos.length; i += BATCH) {
    const lote = insumos.slice(i, i + BATCH);
    const listado = lote
      .map(
        (x) =>
          `- codigo="${x.codigo}" | tipo=${x.tipo} | descripcion="${x.descripcion}"` +
          (x.unidad ? ` | unidad=${x.unidad}` : "") +
          (x.categoria ? ` | categoria_cruda="${x.categoria}"` : ""),
      )
      .join("\n");

    const prompt =
      `Asigná una categoría a cada insumo según QUÉ ES y a qué rubro/gremio pertenece.\n\n` +
      `Categorías sugeridas por tipo (preferilas; si ninguna describe bien al insumo, ` +
      `proponé una categoría corta, clara y en Title Case):\n${sugeridasTexto}\n\n` +
      `Reglas:\n` +
      `- Usá la "categoria_cruda" como pista, pero priorizá la descripción real del insumo.\n` +
      `- Una sola categoría por insumo, breve (1-3 palabras).\n` +
      `- Devolvé exactamente un item por cada código recibido, con el mismo "codigo".\n\n` +
      `Insumos:\n${listado}`;

    try {
      const res = await geminiGenerateJson<{ items?: { codigo: string; categoria: string }[] }>(
        prompt,
        { system, responseSchema, temperature: 0 },
      );
      for (const it of res.items ?? []) {
        if (it?.codigo) out.set(it.codigo, normalizeCategoria(it.categoria));
      }
    } catch (err) {
      console.warn(
        `[categorizer] lote ${i / BATCH + 1} falló (${(err as Error).message}); se saltea`,
      );
    }
  }

  return out;
}

/**
 * Persiste categorías canónicas en bulk (UPDATE ... FROM VALUES, en chunks de 100).
 * Marca fuenteCategoria='ia'. Devuelve la cantidad de insumos actualizados.
 */
export async function persistCategorias(map: Map<string, string>): Promise<number> {
  const entries = [...map.entries()].filter(([codigo, cat]) => codigo && cat);
  if (entries.length === 0) return 0;

  const CHUNK = 100;
  let updated = 0;
  for (let i = 0; i < entries.length; i += CHUNK) {
    const chunk = entries.slice(i, i + CHUNK);
    const valores = chunk
      .map((_, j) => `($${j * 2 + 1}::text, $${j * 2 + 2}::text)`)
      .join(", ");
    const params: string[] = [];
    for (const [codigo, cat] of chunk) params.push(codigo, cat);
    updated += await prisma.$executeRawUnsafe(
      `UPDATE "Insumo" AS i
         SET "categoriaCanonica" = v.cat, "fuenteCategoria" = 'ia', "updatedAt" = NOW()
       FROM (VALUES ${valores}) AS v(codigo, cat)
       WHERE i.codigo = v.codigo`,
      ...params,
    );
  }
  return updated;
}

/**
 * Clasifica y persiste en un paso. Best-effort: si Gemini no está configurado o falla,
 * devuelve 0 sin lanzar. Pensado para el hook de import y el endpoint de backfill.
 */
export async function categorizeAndPersist(insumos: InsumoParaCategorizar[]): Promise<number> {
  if (!isGeminiConfigured() || insumos.length === 0) return 0;
  try {
    const map = await categorizeInsumos(insumos);
    return await persistCategorias(map);
  } catch (err) {
    console.warn(`[categorizer] categorizeAndPersist falló: ${(err as Error).message}`);
    return 0;
  }
}

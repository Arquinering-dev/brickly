/**
 * Importador del APU Unificado (formato GDR).
 *
 * Hojas que consume:
 *   MATERIALES       → Insumo (MATERIAL)
 *   MANO_DE_OBRA     → Insumo (MANO_DE_OBRA)
 *   EQUIPOS          → Insumo (EQUIPO)
 *   SUBCONTRATOS_PRY → Insumo (SUBCONTRATO)  ← códigos SUB-*
 *   PARTIDAS         → Partida
 *   COMPOSICIÓN      → Composicion
 *
 * Modo dryRun=true: parsea y valida sin tocar la DB.
 * Modo dryRun=false: upsert idempotente — seguro de correr varias veces.
 */
import * as XLSX from "xlsx";
import prisma from "../prisma/client";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Row = (string | number | Date | null | undefined)[];

const toStr = (v: unknown): string => (v == null ? "" : String(v).trim());
const toNum = (v: unknown): number => {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const toDate = (v: unknown): Date | undefined => {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  if (typeof v === "string" && v) {
    const d = new Date(v);
    return isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
};

function readSheet(wb: XLSX.WorkBook, name: string): Row[] {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, {
    header: 1, defval: null, raw: false,
  }) as Row[];
}

// ─── Tipos internos ───────────────────────────────────────────────────────────

type TipoInsumo = "MATERIAL" | "MANO_DE_OBRA" | "EQUIPO" | "SUBCONTRATO";

type InsumoData = {
  codigo: string;
  descripcion: string;
  unidad: string;
  precioReferencia: number;
  tipo: TipoInsumo;
  proveedor?: string;
  categoria?: string;
  codigoOriginal?: string;
  fechaCotizacion?: Date;
};

type PartidaData = {
  codigo: string;
  descripcion: string;
  rubro: string;
  unidad: string;
  rendimiento: number;
};

type ComposicionData = {
  partidaCodigo: string;
  insumoCodigo: string;
  cantidadPorUnidad: number;
  pctDesperdicio: number;
  secuencia: number;
};

export type ApuImportResult = {
  insumos: {
    materiales: number;
    manoDeObra: number;
    equipos: number;
    subcontratos: number;
    total: number;
  };
  partidas: number;
  composiciones: number;
  warnings: string[];
  errors: string[];
  dryRun: boolean;
};

// ─── Parsers por hoja ─────────────────────────────────────────────────────────

/** MATERIALES: [Código, Descripción, Unidad, Precio $, Proveedor, Fecha Cotiz., Categoría, Cód. Original] */
function parseMateriales(rows: Row[]): InsumoData[] {
  return rows.slice(1)
    .filter(r => toStr(r?.[0]) && toStr(r?.[1]))
    .map(r => ({
      codigo:           toStr(r![0]),
      descripcion:      toStr(r![1]),
      unidad:           toStr(r![2]) || "u",
      precioReferencia: toNum(r![3]),
      tipo:             "MATERIAL" as const,
      proveedor:        toStr(r![4]) || undefined,
      fechaCotizacion:  toDate(r![5]),
      categoria:        toStr(r![6]) || undefined,
      codigoOriginal:   toStr(r![7]) || undefined,
    }));
}

/** MANO_DE_OBRA: [Código, Descripción, Salario/día, Coef. Cargas, Costo Jornal $, Tipo, Cód. Original] */
function parseManoDeObra(rows: Row[]): InsumoData[] {
  return rows.slice(1)
    .filter(r => toStr(r?.[0]) && toStr(r?.[1]))
    .map(r => ({
      codigo:           toStr(r![0]),
      descripcion:      toStr(r![1]),
      unidad:           "jornada",
      // Preferimos Costo Jornal (con cargas), fallback a salario/día
      precioReferencia: toNum(r![4]) || toNum(r![2]),
      tipo:             "MANO_DE_OBRA" as const,
      categoria:        toStr(r![5]) || undefined,
      codigoOriginal:   toStr(r![6]) || undefined,
    }));
}

/** EQUIPOS: [Código, Descripción, Costo Total Set $, Vida (años), Vida (días), $/día, Cód. Original] */
function parseEquipos(rows: Row[]): InsumoData[] {
  return rows.slice(1)
    .filter(r => toStr(r?.[0]) && toStr(r?.[1]))
    .map(r => ({
      codigo:           toStr(r![0]),
      descripcion:      toStr(r![1]),
      unidad:           "día",
      precioReferencia: toNum(r![5]), // $/día
      tipo:             "EQUIPO" as const,
      codigoOriginal:   toStr(r![6]) || undefined,
    }));
}

/** SUBCONTRATOS_PRY: [Código, Descripción, Ud, Precio Unitario $, Categoría, Notas] */
function parseSubcontratos(rows: Row[]): InsumoData[] {
  return rows.slice(1)
    .filter(r => toStr(r?.[0]) && toStr(r?.[1]))
    .map(r => ({
      codigo:           toStr(r![0]),
      descripcion:      toStr(r![1]),
      unidad:           toStr(r![2]) || "gl",
      precioReferencia: toNum(r![3]),
      tipo:             "SUBCONTRATO" as const,
      categoria:        toStr(r![4]) || undefined,
    }));
}

/** PARTIDAS: [Código, P#, Rubro, Descripción, Ud., Rend., ...] */
function parsePartidas(rows: Row[]): PartidaData[] {
  return rows.slice(1)
    .filter(r => toStr(r?.[0]) && toStr(r?.[3]))
    .map(r => ({
      codigo:      toStr(r![0]),
      descripcion: toStr(r![3]),
      rubro:       toStr(r![2]) || "GENERAL",
      unidad:      toStr(r![4]) || "u",
      rendimiento: toNum(r![5]),
    }));
}

/**
 * COMPOSICIÓN: [Partida, Tipo, Subtipo, Cod_Insumo, Descripción, Cant, %Desp, Precio, Costo, Clave, Count, Clave2]
 * Valida que todos los codes de insumos existan en el catálogo combinado.
 */
function parseComposicion(
  rows: Row[],
  catalogCodes: Set<string>,
  partidaCodes: Set<string>,
): { data: ComposicionData[]; warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];
  const data: ComposicionData[] = [];
  const seqMap = new Map<string, number>();
  const missingInsumos = new Set<string>();
  const missingPartidas = new Set<string>();

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const partidaCodigo = toStr(r[0]);
    const insumoCodigo  = toStr(r[3]);
    const cant          = toNum(r[5]);
    const pctDesp       = toNum(r[6]);

    if (!partidaCodigo || !insumoCodigo) continue;

    if (!partidaCodes.has(partidaCodigo)) {
      missingPartidas.add(partidaCodigo);
      continue;
    }
    if (!catalogCodes.has(insumoCodigo)) {
      missingInsumos.add(insumoCodigo);
      continue;
    }
    if (cant <= 0) {
      warnings.push(`Fila ${i + 1}: cantidad=${cant} (≤0) para ${partidaCodigo} → ${insumoCodigo}`);
    }

    const seq = (seqMap.get(partidaCodigo) ?? 0) + 1;
    seqMap.set(partidaCodigo, seq);
    data.push({ partidaCodigo, insumoCodigo, cantidadPorUnidad: cant, pctDesperdicio: pctDesp, secuencia: seq });
  }

  if (missingPartidas.size > 0)
    errors.push(`${missingPartidas.size} códigos de partida en COMPOSICIÓN no existen en PARTIDAS: ${[...missingPartidas].slice(0, 5).join(", ")}${missingPartidas.size > 5 ? "…" : ""}`);
  if (missingInsumos.size > 0)
    errors.push(`${missingInsumos.size} códigos de insumo en COMPOSICIÓN no existen en el catálogo: ${[...missingInsumos].slice(0, 5).join(", ")}${missingInsumos.size > 5 ? "…" : ""}`);

  return { data, warnings, errors };
}

// ─── Función principal ────────────────────────────────────────────────────────

export async function importApuXlsx(
  buf: Buffer,
  opts: { dryRun?: boolean } = {},
): Promise<ApuImportResult> {
  const { dryRun = false } = opts;
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });

  // 1. Parsear todas las hojas
  const materiales  = parseMateriales(readSheet(wb, "MATERIALES"));
  const manoDeObra  = parseManoDeObra(readSheet(wb, "MANO_DE_OBRA"));
  const equipos     = parseEquipos(readSheet(wb, "EQUIPOS"));
  const subcontratos = parseSubcontratos(readSheet(wb, "SUBCONTRATOS_PRY"));
  const partidas    = parsePartidas(readSheet(wb, "PARTIDAS"));

  // Catálogos de validación cruzada
  const allInsumos = [...materiales, ...manoDeObra, ...equipos, ...subcontratos];
  const catalogCodes = new Set(allInsumos.map(i => i.codigo));
  const partidaCodes  = new Set(partidas.map(p => p.codigo));

  const { data: composiciones, warnings, errors } = parseComposicion(
    readSheet(wb, "COMPOSICIÓN"),
    catalogCodes,
    partidaCodes,
  );

  // Validaciones básicas adicionales
  if (materiales.length === 0)   errors.push("Hoja MATERIALES vacía o no encontrada");
  if (partidas.length === 0)     errors.push("Hoja PARTIDAS vacía o no encontrada");
  if (composiciones.length === 0) errors.push("Hoja COMPOSICIÓN vacía o no encontrada");

  const result: ApuImportResult = {
    insumos: {
      materiales:    materiales.length,
      manoDeObra:    manoDeObra.length,
      equipos:       equipos.length,
      subcontratos:  subcontratos.length,
      total:         allInsumos.length,
    },
    partidas:      partidas.length,
    composiciones: composiciones.length,
    warnings,
    errors,
    dryRun,
  };

  if (dryRun || errors.length > 0) return result;

  // 2. Persistir en DB ───────────────────────────────────────────────────────

  // 2a. Upsert insumos (por código)
  for (const ins of allInsumos) {
    await prisma.insumo.upsert({
      where:  { codigo: ins.codigo },
      create: {
        codigo:           ins.codigo,
        descripcion:      ins.descripcion,
        tipo:             ins.tipo,
        unidad:           ins.unidad,
        precioReferencia: ins.precioReferencia,
        proveedor:        ins.proveedor ?? null,
        categoria:        ins.categoria ?? null,
        codigoOriginal:   ins.codigoOriginal ?? null,
        fechaCotizacion:  ins.fechaCotizacion ?? null,
      },
      update: {
        descripcion:      ins.descripcion,
        unidad:           ins.unidad,
        precioReferencia: ins.precioReferencia,
        proveedor:        ins.proveedor ?? null,
        categoria:        ins.categoria ?? null,
        codigoOriginal:   ins.codigoOriginal ?? null,
        fechaCotizacion:  ins.fechaCotizacion ?? null,
      },
    });
  }

  // 2b. Upsert partidas (por código)
  for (const p of partidas) {
    await prisma.partida.upsert({
      where:  { codigo: p.codigo },
      create: {
        codigo:      p.codigo,
        descripcion: p.descripcion,
        rubro:       p.rubro,
        unidad:      p.unidad,
        rendimiento: p.rendimiento,
        tipo:        "APU",
        scope:       "APU",
        activa:      true,
      },
      update: {
        descripcion: p.descripcion,
        rubro:       p.rubro,
        unidad:      p.unidad,
        rendimiento: p.rendimiento,
      },
    });
  }

  // 2c. Composiciones: leer UUIDs del resultado de los upserts
  const [insumoRows, partidaRows] = await Promise.all([
    prisma.insumo.findMany({
      where:  { codigo: { in: [...catalogCodes] } },
      select: { id: true, codigo: true },
    }),
    prisma.partida.findMany({
      where:  { codigo: { in: [...partidaCodes] } },
      select: { id: true, codigo: true },
    }),
  ]);

  const insumoIdMap  = new Map(insumoRows.map(r => [r.codigo, r.id]));
  const partidaIdMap = new Map(partidaRows.map(r => [r.codigo, r.id]));

  // Agrupar composiciones por partida para delete+createMany en batch
  const byPartida = new Map<string, ComposicionData[]>();
  for (const c of composiciones) {
    const arr = byPartida.get(c.partidaCodigo) ?? [];
    arr.push(c);
    byPartida.set(c.partidaCodigo, arr);
  }

  // Procesar en bloques de 20 partidas para no saturar la conexión
  const BATCH = 20;
  const entries = [...byPartida.entries()];
  for (let i = 0; i < entries.length; i += BATCH) {
    const slice = entries.slice(i, i + BATCH);
    await prisma.$transaction(
      slice.map(([partidaCodigo, rows]) => {
        const partidaId = partidaIdMap.get(partidaCodigo)!;
        return prisma.composicion.deleteMany({ where: { partidaId } });
      }),
    );
    for (const [partidaCodigo, rows] of slice) {
      const partidaId = partidaIdMap.get(partidaCodigo);
      if (!partidaId) continue;
      const data = rows
        .map(c => {
          const insumoId = insumoIdMap.get(c.insumoCodigo);
          if (!insumoId) return null;
          return {
            partidaId,
            insumoId,
            cantidadPorUnidad: c.cantidadPorUnidad,
            pctDesperdicio:    c.pctDesperdicio,
            secuencia:         c.secuencia,
          };
        })
        .filter(Boolean) as {
          partidaId: string; insumoId: string;
          cantidadPorUnidad: number; pctDesperdicio: number; secuencia: number;
        }[];
      if (data.length > 0) {
        await prisma.composicion.createMany({ data });
      }
    }
  }

  return result;
}

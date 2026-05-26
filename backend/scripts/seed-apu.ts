/**
 * Seed APU — Importa el APU general (xlsx) al catálogo maestro.
 *
 * Uso: npm run seed:apu -- /ruta/al/ARQING-APU-XX-YY.xlsx
 *
 * Comportamiento: upsert in-place.
 *  - Insumos: match por (codigoOriginal || descripcion+tipo+unidad). Actualiza precio.
 *  - Partidas: match por codigo (= nombre de hoja "P-XX"). Recrea composiciones.
 *  - scope=APU, obraId=null
 */
import * as XLSX from "xlsx";
import * as path from "path";
import * as fs from "fs";
import prisma from "../src/prisma/client";

type Row = (string | number | Date | null | undefined)[];

// ─── Utilidades ────────────────────────────────────────────────────────────────
const toStr = (v: unknown): string => (v == null ? "" : String(v).trim());
const toNum = (v: unknown): number => {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

function readSheet(wb: XLSX.WorkBook, name: string): Row[] {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true }) as Row[];
}

function findHeaderRow(rows: Row[], firstCellMatch: RegExp, maxScan = 15): number {
  for (let i = 0; i < Math.min(rows.length, maxScan); i++) {
    const cell = toStr(rows[i]?.[0]);
    if (firstCellMatch.test(cell)) return i;
  }
  return -1;
}

// ─── Parsers maestras ─────────────────────────────────────────────────────────
type InsumoSeed = {
  codigo: string;            // codigoOriginal del Excel (o sintético)
  descripcion: string;
  tipo: "MATERIAL" | "MANO_DE_OBRA" | "EQUIPO" | "SUBCONTRATO";
  unidad: string;
  precio: number;
  proveedor?: string;
};

function parseMateriales(wb: XLSX.WorkBook): InsumoSeed[] {
  const rows = readSheet(wb, "Materiales");
  const hi = findHeaderRow(rows, /^c[oó]digo$/i);
  if (hi < 0) return [];
  const out: InsumoSeed[] = [];
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i];
    const codigo = toStr(r?.[0]);
    const desc = toStr(r?.[1]);
    if (!desc) continue;
    out.push({
      codigo: codigo || `MAT-${slug(desc)}`,
      descripcion: desc,
      tipo: "MATERIAL",
      unidad: toStr(r?.[2]) || "u",
      precio: toNum(r?.[3]),
      proveedor: toStr(r?.[4]) || undefined,
    });
  }
  return out;
}

function parseManoDeObra(wb: XLSX.WorkBook): InsumoSeed[] {
  const rows = readSheet(wb, "Mano de Obra");
  const hi = findHeaderRow(rows, /^c[oó]digo$/i);
  if (hi < 0) return [];
  const out: InsumoSeed[] = [];
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i];
    const codigo = toStr(r?.[0]);
    const desc = toStr(r?.[1]);
    if (!desc) continue;
    // Costo Jornal está en col G (índice 6); si no, calculamos salario+prestaciones
    const salario = toNum(r?.[2]);
    const prest = toNum(r?.[3]);
    const jornal = toNum(r?.[6]);
    const precio = jornal > 0 ? jornal : salario * (1 + (prest || 0));
    out.push({
      codigo: codigo || `MO-${slug(desc)}`,
      descripcion: desc,
      tipo: "MANO_DE_OBRA",
      unidad: "j",
      precio,
    });
  }
  return out;
}

function parseSubContratos(wb: XLSX.WorkBook): InsumoSeed[] {
  const rows = readSheet(wb, "Sub CONTRATOS");
  const hi = findHeaderRow(rows, /^rubro$/i);
  if (hi < 0) return [];
  const out: InsumoSeed[] = [];
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i];
    const rubro = toStr(r?.[0]);
    const tarea = toStr(r?.[1]);
    if (!tarea) continue;
    const contratista = toStr(r?.[2]);
    const unidad = toStr(r?.[3]) || "u";
    const pu = toNum(r?.[4]);
    const desc = rubro ? `${rubro} — ${tarea}` : tarea;
    out.push({
      codigo: `SUB-${slug(desc)}`,
      descripcion: desc,
      tipo: "SUBCONTRATO",
      unidad,
      precio: pu,
      proveedor: contratista || undefined,
    });
  }
  return out;
}

function parsePrecioEquipos(wb: XLSX.WorkBook): InsumoSeed[] {
  // Header en fila 3 (índice 3): "DESCRIPCION", "P. Unit", "Fecha ", "Proveedor"
  const rows = readSheet(wb, "Precio Equipos");
  const hi = findHeaderRow(rows.map((r) => [toStr(r?.[1])]) as Row[], /^descripcion$/i, 10);
  if (hi < 0) return [];
  const out: InsumoSeed[] = [];
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i];
    const desc = toStr(r?.[1]);
    if (!desc) continue;
    const pu = toNum(r?.[2]);
    out.push({
      codigo: `EQ-${slug(desc)}`,
      descripcion: desc,
      tipo: "EQUIPO",
      unidad: "u",
      precio: pu,
      proveedor: toStr(r?.[4]) || undefined,
    });
  }
  return out;
}

function slug(s: string): string {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

// ─── Parser partida (hoja P-XX) ────────────────────────────────────────────────
type CompSeed = {
  insumoMatch: { codigo?: string; descripcion: string; unidad: string; tipo: InsumoSeed["tipo"] };
  cantidadPorUnidad: number;
  pctDesperdicio: number;
  secuencia: number;
};

type PartidaSeed = {
  codigo: string;        // ej "P-32"
  descripcion: string;
  unidad: string;
  rendimiento: number | null;
  rubro: string;         // se infiere; default GENERAL
  composiciones: CompSeed[];
};

function parsePartidaSheet(wb: XLSX.WorkBook, sheetName: string): PartidaSeed | null {
  const rows = readSheet(wb, sheetName);
  if (rows.length < 10) return null;

  // R6 col B = descripción de partida
  let descripcion = "";
  let unidad = "u";
  let rendimiento: number | null = null;

  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const r = rows[i] ?? [];
    const c0 = toStr(r[0]);
    if (/^partida:$/i.test(c0)) descripcion = toStr(r[1]);
    if (/^unidad$|unidad:/i.test(c0) || /unidad/i.test(toStr(r[2]))) {
      // header en fila siguiente
      const datRow = rows[i + 1] ?? [];
      const u = toStr(datRow[2]);
      const cant = toNum(datRow[4]); // cantidad
      const rend = toNum(datRow[5]); // rendimiento
      if (u) unidad = u;
      if (rend > 0) rendimiento = rend;
      void cant;
    }
  }
  if (!descripcion) return null;

  const composiciones: CompSeed[] = [];
  let seq = 0;

  // Recorrer y agarrar bloques MATERIALES / EQUIPOS / MANO DE OBRA
  let i = 0;
  while (i < rows.length) {
    const c0 = toStr(rows[i]?.[0]);
    let tipo: InsumoSeed["tipo"] | null = null;
    if (/^1\.-\s*MATERIALES/i.test(c0)) tipo = "MATERIAL";
    else if (/^2\.-\s*EQUIPOS/i.test(c0)) tipo = "EQUIPO";
    else if (/^3\.-\s*MANO DE OBRA/i.test(c0)) tipo = "MANO_DE_OBRA";
    if (!tipo) { i++; continue; }

    // saltar header (fila siguiente "Código | Descripción | Unidad | Cantidad | ...")
    let j = i + 2;
    while (j < rows.length) {
      const r = rows[j] ?? [];
      const ftext = toStr(r[5]);
      if (/^Total/i.test(ftext) || /^Total/i.test(toStr(r[0]))) break;
      const desc = toStr(r[1]);
      if (desc) {
        const codigo = toStr(r[0]) || undefined;
        const u = toStr(r[2]) || "u";
        const cant = toNum(r[3]);
        const desp = tipo === "MATERIAL" ? toNum(r[5]) / 100 : 0;
        if (cant > 0) {
          composiciones.push({
            insumoMatch: { codigo, descripcion: desc, unidad: u, tipo },
            cantidadPorUnidad: cant,
            pctDesperdicio: desp,
            secuencia: seq++,
          });
        }
      }
      j++;
    }
    i = j + 1;
  }

  return {
    codigo: sheetName,
    descripcion,
    unidad,
    rendimiento,
    rubro: inferRubro(descripcion),
    composiciones,
  };
}

// Heurística de rubro a partir de la descripción
function inferRubro(desc: string): string {
  const d = desc.toLowerCase();
  if (/movimiento|excav|tosca|relleno/.test(d)) return "MOVIMIENTO DE SUELOS";
  if (/horm|h°a°|h\.a\.|losa|viga|columna|encof|armadu/.test(d)) return "HORMIGÓN ARMADO";
  if (/mamposter|ladrillo|bloque/.test(d)) return "MAMPOSTERÍA";
  if (/revoque|enlucido|grueso|fino/.test(d)) return "REVOQUES";
  if (/contrapiso|carpeta|cement.* alisado|cilindrado/.test(d)) return "CONTRAPISOS Y CARPETAS";
  if (/cieloraso|cielorraso/.test(d)) return "CIELORRASOS";
  if (/pintura|látex|esmalte/.test(d)) return "PINTURA";
  if (/cer[aá]mic|porcelan|zócalo|piso|revestim/.test(d)) return "PISOS Y REVESTIMIENTOS";
  if (/aberturas?|carpinter[ií]a|ventana|puerta/.test(d)) return "ABERTURAS";
  if (/instal.* el[eé]ctr|electric/.test(d)) return "INSTALACIÓN ELÉCTRICA";
  if (/instal.* sanit|cloacal|agua fr|af\.|agua cal|ac\./.test(d)) return "INSTALACIÓN SANITARIA";
  if (/incendio|hidrante/.test(d)) return "INSTALACIÓN DE INCENDIO";
  if (/gas/.test(d)) return "INSTALACIÓN DE GAS";
  if (/calefac|aire|climat/.test(d)) return "CLIMATIZACIÓN";
  if (/aislaci[oó]n|membrana|impermeab/.test(d)) return "AISLACIONES";
  return "GENERAL";
}

// ─── Run ───────────────────────────────────────────────────────────────────────
// Path por defecto del APU vigente — dentro del repo para evitar bloqueos de TCC
// en ~/Downloads en macOS. Para iterar con un APU más reciente, reemplazá el
// archivo en backend/data/apu/ (mismo formato) o pasá una ruta como argumento.
const DEFAULT_APU_PATH = path.resolve(__dirname, "../data/apu/ARQING - APU 06-25.xlsx");

async function main() {
  const filePath = process.argv[2] ?? DEFAULT_APU_PATH;
  if (!fs.existsSync(filePath)) {
    console.error(`No existe el archivo: ${filePath}`);
    console.error(`Pasá la ruta como argumento: npm run seed:apu -- /ruta/al/archivo.xlsx`);
    process.exit(1);
  }

  console.log(`📄 Leyendo ${path.basename(filePath)}...`);
  const buf = fs.readFileSync(filePath);
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });

  // ── 1) Parsear maestras ─────────────────────────────────────────────────────
  const mats = parseMateriales(wb);
  const mos = parseManoDeObra(wb);
  const subs = parseSubContratos(wb);
  const eqs = parsePrecioEquipos(wb);
  console.log(`🧱 Materiales: ${mats.length}`);
  console.log(`👷 Mano de Obra: ${mos.length}`);
  console.log(`🚜 Equipos: ${eqs.length}`);
  console.log(`📋 Subcontratos: ${subs.length}`);

  // ── 2) Upsert insumos ───────────────────────────────────────────────────────
  const allInsumos: InsumoSeed[] = [...mats, ...mos, ...eqs, ...subs];
  let creados = 0, actualizados = 0;

  // Cache para lookup posterior por (tipo+descripcion+unidad) normalizado
  type InsumoRef = { id: string; codigo: string; descripcion: string; tipo: string; unidad: string };
  const insumoIndex = new Map<string, InsumoRef>();
  const keyFor = (i: { descripcion: string; tipo: string; unidad: string }) =>
    `${i.tipo}|${i.unidad.toLowerCase()}|${i.descripcion.toLowerCase().replace(/\s+/g, " ").trim()}`;

  for (const seed of allInsumos) {
    // Buscar por codigoOriginal del Excel primero
    const existente = await prisma.insumo.findFirst({
      where: {
        OR: [
          { codigoOriginal: seed.codigo },
          { codigo: seed.codigo },
        ],
      },
    });

    let saved;
    if (existente) {
      saved = await prisma.insumo.update({
        where: { id: existente.id },
        data: {
          descripcion: seed.descripcion,
          unidad: seed.unidad,
          tipo: seed.tipo,
          precioReferencia: seed.precio,
          proveedor: seed.proveedor ?? existente.proveedor,
          codigoOriginal: seed.codigo,
        },
      });
      actualizados++;
    } else {
      // codigo único — si choca, sufijar
      let codigoFinal = seed.codigo;
      let attempt = 0;
      while (await prisma.insumo.findUnique({ where: { codigo: codigoFinal } })) {
        attempt++;
        codigoFinal = `${seed.codigo}-${attempt}`;
      }
      saved = await prisma.insumo.create({
        data: {
          codigo: codigoFinal,
          codigoOriginal: seed.codigo,
          descripcion: seed.descripcion,
          unidad: seed.unidad,
          tipo: seed.tipo,
          precioReferencia: seed.precio,
          proveedor: seed.proveedor,
        },
      });
      creados++;
    }
    insumoIndex.set(keyFor(seed), {
      id: saved.id,
      codigo: saved.codigo,
      descripcion: saved.descripcion,
      tipo: saved.tipo,
      unidad: saved.unidad,
    });
  }
  console.log(`✅ Insumos: +${creados} creados, ~${actualizados} actualizados`);

  // ── 3) Parsear y upsert partidas (hojas P-XX) ───────────────────────────────
  const partidaSheets = wb.SheetNames.filter((n) => /^P-\d+/i.test(n));
  console.log(`📐 Hojas de partida encontradas: ${partidaSheets.length}`);

  // Pre-carga insumos para resolver matches por descripcion (fallback)
  const allInsumosDB = await prisma.insumo.findMany({
    select: { id: true, codigo: true, codigoOriginal: true, descripcion: true, tipo: true, unidad: true },
  });
  for (const ins of allInsumosDB) {
    insumoIndex.set(keyFor(ins), {
      id: ins.id, codigo: ins.codigo, descripcion: ins.descripcion, tipo: ins.tipo, unidad: ins.unidad,
    });
  }
  const insumosByCodigoOriginal = new Map(allInsumosDB.filter((i) => i.codigoOriginal).map((i) => [i.codigoOriginal!, i]));

  function resolveInsumoId(m: CompSeed["insumoMatch"]): string | null {
    if (m.codigo && insumosByCodigoOriginal.has(m.codigo)) {
      return insumosByCodigoOriginal.get(m.codigo)!.id;
    }
    const exact = insumoIndex.get(keyFor(m));
    if (exact) return exact.id;
    // Fallback: ignorar unidad — algunas partidas usan unidades distintas a la maestra
    for (const v of insumoIndex.values()) {
      if (v.tipo === m.tipo && v.descripcion.toLowerCase().trim() === m.descripcion.toLowerCase().trim()) {
        return v.id;
      }
    }
    return null;
  }

  let partidasCreadas = 0, partidasActualizadas = 0, insumosFaltantes = 0;

  for (const sname of partidaSheets) {
    const seed = parsePartidaSheet(wb, sname);
    if (!seed) continue;

    // Upsert partida por codigo
    const existing = await prisma.partida.findUnique({ where: { codigo: seed.codigo } });
    let partidaId: string;
    if (existing) {
      const upd = await prisma.partida.update({
        where: { id: existing.id },
        data: {
          descripcion: seed.descripcion,
          unidad: seed.unidad,
          rendimiento: seed.rendimiento,
          rubro: seed.rubro,
          scope: "APU",
          obraId: null,
          activa: true,
        },
      });
      partidaId = upd.id;
      partidasActualizadas++;
    } else {
      const created = await prisma.partida.create({
        data: {
          codigo: seed.codigo,
          descripcion: seed.descripcion,
          unidad: seed.unidad,
          rendimiento: seed.rendimiento,
          rubro: seed.rubro,
          tipo: "APU",
          scope: "APU",
          obraId: null,
          activa: true,
        },
      });
      partidaId = created.id;
      partidasCreadas++;
    }

    // Recrear composiciones
    await prisma.composicion.deleteMany({ where: { partidaId } });

    const composToInsert: Array<{ partidaId: string; insumoId: string; cantidadPorUnidad: number; pctDesperdicio: number; secuencia: number }> = [];
    for (const c of seed.composiciones) {
      let insumoId = resolveInsumoId(c.insumoMatch);
      if (!insumoId) {
        // Crear insumo "huérfano" auto
        const codigoSint = c.insumoMatch.codigo || `${c.insumoMatch.tipo.slice(0, 3)}-${slug(c.insumoMatch.descripcion)}`;
        let codigoFinal = codigoSint;
        let attempt = 0;
        while (await prisma.insumo.findUnique({ where: { codigo: codigoFinal } })) {
          attempt++;
          codigoFinal = `${codigoSint}-${attempt}`;
        }
        const created = await prisma.insumo.create({
          data: {
            codigo: codigoFinal,
            codigoOriginal: c.insumoMatch.codigo ?? null,
            descripcion: c.insumoMatch.descripcion,
            unidad: c.insumoMatch.unidad,
            tipo: c.insumoMatch.tipo,
            precioReferencia: 0,
          },
        });
        insumoId = created.id;
        insumoIndex.set(keyFor(c.insumoMatch), {
          id: created.id, codigo: created.codigo, descripcion: created.descripcion, tipo: created.tipo, unidad: created.unidad,
        });
        if (c.insumoMatch.codigo) insumosByCodigoOriginal.set(c.insumoMatch.codigo, created);
        insumosFaltantes++;
      }
      composToInsert.push({
        partidaId,
        insumoId,
        cantidadPorUnidad: c.cantidadPorUnidad,
        pctDesperdicio: c.pctDesperdicio,
        secuencia: c.secuencia,
      });
    }
    if (composToInsert.length > 0) {
      await prisma.composicion.createMany({ data: composToInsert });
    }
  }
  console.log(`✅ Partidas: +${partidasCreadas} creadas, ~${partidasActualizadas} actualizadas`);
  if (insumosFaltantes > 0) {
    console.log(`⚠️  ${insumosFaltantes} insumos en partidas no estaban en maestras — creados con precio 0`);
  }

  await prisma.$disconnect();
  console.log("🎉 Seed APU completado");
}

main().catch((err) => {
  console.error("❌ Error en seed APU:", err);
  process.exit(1);
});

/**
 * Parser de presupuesto de obra (.xlsx).
 * Soporta dos formatos:
 *   1) Formato GDR (hoja "01" con cabecera "OBRA: ...", filas item.subitem)
 *   2) Formato Aprobado (hoja única con "E | Descripción | U | Cant | P unit | Subtotal" y opcional MES 0..N)
 *
 * Devuelve un preview con líneas, obra detectada y matches contra el catálogo de partidas.
 * No persiste nada.
 */
import * as XLSX from "xlsx";
import prisma from "../prisma/client";

type Row = (string | number | Date | null | undefined)[];

const toStr = (v: unknown): string => (v == null ? "" : String(v).trim());
const toNum = (v: unknown): number => {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const normDesc = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ").trim();

function readSheet(wb: XLSX.WorkBook, name: string): Row[] {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true }) as Row[];
}

export type LineaPreview = {
  itemNumero: string | null;
  descripcion: string;
  unidad: string;
  cantidad: number;
  matUd: number;
  moUd: number;
  eqUd: number;
  precioUnitario: number;
  precioVenta: number | null;
  rubro: string;
  isRubroRow: boolean;
  // Cronograma opcional (% por mes ordinal, en %)
  cronograma?: number[];
  // Match contra catálogo APU
  match?: {
    partidaId: string;
    codigo: string;
    descripcion: string;
    score: number;
  } | null;
};

export type PresupuestoPreview = {
  obraDetectada: {
    nombre: string;
    codigo: string;
  } | null;
  formato: "GDR" | "APROBADO" | "UNKNOWN";
  hojaUsada: string;
  totales: {
    totalCD: number;
    totalPV: number;
    tareasCount: number;
    rubrosCount: number;
  };
  lineas: LineaPreview[];
  cronogramaMeses: { mesOrdinal: number; fecha: string | null; etiqueta: string }[];
  warnings: string[];
};

// ─── Similaridad rápida (Jaccard sobre tokens) ────────────────────────────────
function similarity(a: string, b: string): number {
  const ta = new Set(normDesc(a).split(" ").filter((t) => t.length >= 3));
  const tb = new Set(normDesc(b).split(" ").filter((t) => t.length >= 3));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

async function matchPartidas(
  lineas: LineaPreview[]
): Promise<void> {
  const candidatas = await prisma.partida.findMany({
    where: { scope: "APU", activa: true },
    select: { id: true, codigo: true, descripcion: true },
  });
  for (const linea of lineas) {
    if (linea.isRubroRow) continue;
    let best = { partidaId: "", codigo: "", descripcion: "", score: 0 };
    for (const c of candidatas) {
      const s = similarity(linea.descripcion, c.descripcion);
      if (s > best.score) best = { partidaId: c.id, codigo: c.codigo, descripcion: c.descripcion, score: s };
    }
    linea.match = best.score >= 0.35 ? best : null;
  }
}

// ─── Formato GDR (hoja "01") ───────────────────────────────────────────────────
function parseGDR(wb: XLSX.WorkBook): PresupuestoPreview | null {
  const sheet = wb.SheetNames.find((n) => /^0?1$/i.test(n) || /^presup/i.test(n)) ?? "01";
  if (!wb.Sheets[sheet]) return null;
  const rows = readSheet(wb, sheet);

  // Detectar header
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const r = rows[i] ?? [];
    const c2 = toStr(r[2]).toLowerCase();
    if (c2 === "descripción" || c2 === "descripcion") {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return null;

  // Detectar nombre de obra
  let obraNombre = "";
  for (let i = 0; i < headerIdx; i++) {
    const c2 = toStr(rows[i]?.[2]);
    if (/^OBRA:/i.test(c2)) {
      obraNombre = c2.replace(/^OBRA:\s*/i, "").trim();
      break;
    }
  }

  const lineas: LineaPreview[] = [];
  let rubroActual = "GENERAL";
  let totalCD = 0;
  const rubrosSet = new Set<string>();

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const item = r[0];
    const desc = toStr(r[2]);
    if (!desc) continue;

    // Es rubro si el item es entero (sin decimales) o no hay cantidad/unidad
    const itemStr = toStr(item);
    const isRubroRow = /^\d+$/.test(itemStr) && !toStr(r[3]);

    const unidad = toStr(r[3]);
    const cantidad = toNum(r[4]);
    const matUd = toNum(r[7]);   // MAT Total
    const moUd = toNum(r[10]);   // MO Total
    const eqUd = toNum(r[11]);   // EQUIPOS

    if (isRubroRow) {
      rubroActual = desc.toUpperCase();
      rubrosSet.add(rubroActual);
      lineas.push({
        itemNumero: itemStr,
        descripcion: desc,
        unidad: "",
        cantidad: 0,
        matUd: 0, moUd: 0, eqUd: 0,
        precioUnitario: 0,
        precioVenta: null,
        rubro: rubroActual,
        isRubroRow: true,
      });
      continue;
    }

    const precioUnit = matUd + moUd + eqUd;
    if (cantidad <= 0 && precioUnit <= 0) continue;

    lineas.push({
      itemNumero: itemStr,
      descripcion: desc,
      unidad: unidad || "u",
      cantidad,
      matUd,
      moUd,
      eqUd,
      precioUnitario: precioUnit,
      precioVenta: null,
      rubro: rubroActual,
      isRubroRow: false,
    });
    totalCD += cantidad * precioUnit;
  }

  return {
    obraDetectada: obraNombre ? { nombre: obraNombre, codigo: extraerCodigo(obraNombre) } : null,
    formato: "GDR",
    hojaUsada: sheet,
    totales: {
      totalCD,
      totalPV: 0,
      tareasCount: lineas.filter((l) => !l.isRubroRow).length,
      rubrosCount: rubrosSet.size,
    },
    lineas,
    cronogramaMeses: [],
    warnings: [],
  };
}

function extraerCodigo(nombre: string): string {
  const m = nombre.match(/([A-Z]+\s*\d+|\d+)/);
  return m ? m[1].replace(/\s+/g, "") : nombre.slice(0, 10).toUpperCase().replace(/\s+/g, "");
}

// ─── Formato Aprobado (hoja con MES 0..N o sin cronograma) ─────────────────────
function parseAprobado(wb: XLSX.WorkBook): PresupuestoPreview | null {
  // Preferimos hojas con cronograma (más cols MES). Las ordenamos por cantidad de matches MES en headers.
  const sheetScores: { name: string; score: number }[] = wb.SheetNames.map((name) => {
    const rows = readSheet(wb, name);
    let score = 0;
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      for (const cell of rows[i] ?? []) {
        if (/^mes\s*\d+/i.test(toStr(cell))) score++;
      }
    }
    return { name, score };
  }).sort((a, b) => b.score - a.score);

  for (const { name: sheetName } of sheetScores) {
    const rows = readSheet(wb, sheetName);
    if (rows.length < 5) continue;

    // Detectar headers: escanea las primeras 20 filas, combina lo encontrado en distintas filas
    // (en formato aprobado, "Descripción/U/Cant" y "MES 0..N" suelen estar en filas distintas).
    let headerIdx = -1;
    const cols: Record<string, number> = {};
    const fechaPorCol = new Map<number, Date>();
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const r = rows[i] ?? [];
      r.forEach((cell, j) => {
        const s = toStr(cell).toLowerCase();
        if (/^descrip/.test(s) && cols.desc === undefined) { cols.desc = j; if (headerIdx < 0) headerIdx = i; }
        if ((s === "u" || s === "ud" || s === "unidad") && cols.unidad === undefined) cols.unidad = j;
        if ((s === "cant" || s === "cantidad") && cols.cant === undefined) cols.cant = j;
        if ((/^p\.?\s*unit/.test(s) || /precio unit/.test(s)) && cols.pu === undefined) cols.pu = j;
        if ((/^subtotal$/.test(s) || /^total$/.test(s)) && cols.subtotal === undefined) cols.subtotal = j;
        if (/^mes\s*\d+/i.test(s)) {
          const n = parseInt(s.replace(/[^0-9]/g, ""), 10);
          if (Number.isFinite(n) && cols[`mes_${n}`] === undefined) cols[`mes_${n}`] = j;
        }
        // Las celdas con fecha en filas pre-header las guardamos por columna (para MES X)
        if (cell instanceof Date) fechaPorCol.set(j, cell);
      });
      // Si esta fila tiene "Descripción"/"Cant", la marcamos como header — pero seguimos escaneando
      // para juntar las cols MES X de filas siguientes (raras veces) o de filas previas.
    }
    if (headerIdx < 0 || cols.desc === undefined || cols.cant === undefined || cols.pu === undefined) continue;

    // Encontrar todas las cols MES
    const mesCols: { ordinal: number; col: number }[] = [];
    for (const [k, v] of Object.entries(cols)) {
      const m = k.match(/^mes_(\d+)$/);
      if (m) mesCols.push({ ordinal: parseInt(m[1], 10), col: v });
    }
    mesCols.sort((a, b) => a.ordinal - b.ordinal);

    const cronogramaMeses: { mesOrdinal: number; fecha: string | null; etiqueta: string }[] = mesCols.map((m) => {
      const fecha = fechaPorCol.get(m.col) ?? null;
      return { mesOrdinal: m.ordinal, fecha: fecha ? fecha.toISOString() : null, etiqueta: `MES ${m.ordinal}` };
    });

    let obraNombre = "";
    for (let i = 0; i < headerIdx; i++) {
      for (const c of rows[i] ?? []) {
        const s = toStr(c);
        if (/^OBRA:/i.test(s) || /AING/i.test(s) || /CH\s*\d+/i.test(s) || /GDR\s*\d+/i.test(s)) {
          obraNombre = s.replace(/^OBRA:\s*/i, "").trim();
          break;
        }
      }
      if (obraNombre) break;
    }

    const lineas: LineaPreview[] = [];
    let rubroActual = "GENERAL";
    let totalCD = 0;
    let totalPV = 0;
    const rubrosSet = new Set<string>();

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i] ?? [];
      const desc = toStr(r[cols.desc]);
      if (!desc) continue;
      const itemStr = toStr(r[0]);
      const unidad = toStr(r[cols.unidad ?? -1]);
      const cantidad = toNum(r[cols.cant]);
      const pu = toNum(r[cols.pu]);
      const subtotal = cols.subtotal !== undefined ? toNum(r[cols.subtotal]) : cantidad * pu;

      const isRubroRow = /^\d+$/.test(itemStr) && !unidad && cantidad === 0;
      if (isRubroRow) {
        rubroActual = desc.toUpperCase();
        rubrosSet.add(rubroActual);
        lineas.push({
          itemNumero: itemStr || null,
          descripcion: desc,
          unidad: "",
          cantidad: 0,
          matUd: 0, moUd: 0, eqUd: 0,
          precioUnitario: 0,
          precioVenta: null,
          rubro: rubroActual,
          isRubroRow: true,
        });
        continue;
      }
      if (cantidad <= 0 && pu <= 0) continue;

      // Cronograma: leer % de cada mes
      const cronograma: number[] = mesCols.map((m) => toNum(r[m.col]));
      const sumCron = cronograma.reduce((a, b) => a + b, 0);
      const cronogramaPct = sumCron > 0 ? cronograma.map((v) => v / sumCron) : [];

      lineas.push({
        itemNumero: itemStr || null,
        descripcion: desc,
        unidad: unidad || "u",
        cantidad,
        matUd: 0,
        moUd: 0,
        eqUd: 0,
        precioUnitario: pu,
        precioVenta: pu, // En aprobado, precioUnitario YA es precio venta
        rubro: rubroActual,
        isRubroRow: false,
        cronograma: cronogramaPct.length > 0 ? cronogramaPct : undefined,
      });
      totalCD += subtotal;
      totalPV += subtotal;
    }

    return {
      obraDetectada: obraNombre ? { nombre: obraNombre, codigo: extraerCodigo(obraNombre) } : null,
      formato: "APROBADO",
      hojaUsada: sheetName,
      totales: {
        totalCD,
        totalPV,
        tareasCount: lineas.filter((l) => !l.isRubroRow).length,
        rubrosCount: rubrosSet.size,
      },
      lineas,
      cronogramaMeses,
      warnings: mesCols.length > 0 ? [] : ["No se detectó cronograma mes a mes"],
    };
  }
  return null;
}

export async function parsePresupuestoXlsx(buf: Buffer, opts: { tipo?: "GENERADOR" | "APROBADO" } = {}): Promise<PresupuestoPreview> {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });

  const tryParsers = opts.tipo === "APROBADO"
    ? [parseAprobado, parseGDR]
    : [parseGDR, parseAprobado];

  let preview: PresupuestoPreview | null = null;
  for (const fn of tryParsers) {
    preview = fn(wb);
    if (preview && preview.lineas.length > 0) break;
  }
  if (!preview) {
    return {
      obraDetectada: null,
      formato: "UNKNOWN",
      hojaUsada: "",
      totales: { totalCD: 0, totalPV: 0, tareasCount: 0, rubrosCount: 0 },
      lineas: [],
      cronogramaMeses: [],
      warnings: ["No se pudo identificar el formato del archivo"],
    };
  }

  await matchPartidas(preview.lineas);
  return preview;
}

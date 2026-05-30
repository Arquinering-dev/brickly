/**
 * inject-aprobado.ts — Conversión raw → unificado (paso offline de §4 de PRODUCT.md).
 *
 * Lee el archivo "aprobado + cashflow" de cada obra y le agrega al APU Unificado una hoja
 * `PPTO_APROBADO` con: precio de venta por ítem + cronograma (% de ejecución por mes calendario).
 * También fija el coeficiente GGBB (K) correcto en PPTO_GENERADOR.
 *
 * Dry-run (default): solo analiza e imprime chequeos.   →  npx tsx scripts/inject-aprobado.ts
 * Escribir:                                              →  npx tsx scripts/inject-aprobado.ts --write
 */
import * as XLSX from "xlsx";

const DL = "/Users/pablopagliaricci/Downloads";
const WRITE = process.argv.includes("--write");

interface ObraCfg {
  code: string;
  unified: string;
  aprobado: string;
  aprobadoSheet: string;
  K: number; // coeficiente GGBB (A+B)/A calculado desde la hoja GGBB del presupuesto interno
}

const OBRAS: ObraCfg[] = [
  { code: "GDR3760", unified: `${DL}/APU_Unificado_GDR3760_VF.xlsx`, aprobado: `${DL}/AING - GDR3760 01 APROBADO.xlsx`, aprobadoSheet: "Proyeccion - Venta", K: 1.3327 },
  { code: "CH2171",  unified: `${DL}/APU_Unificado_CH2171_v4_4.xlsx`, aprobado: `${DL}/AING - CH 2171 02 Y CASHFLOW 02 jp.xlsx`, aprobadoSheet: "AING CH2171 01", K: 1.3565 },
];

const MONTHS: Record<string, number> = {
  ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7,
  ago: 8, aug: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12, dec: 12,
};

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const money = (v: unknown) => {
  const n = Number(String(v ?? "").replace(/[^0-9.,-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};
function pct(v: unknown): number {
  const s = String(v ?? "").trim();
  if (!s) return 0;
  if (s.includes("%")) return (parseFloat(s.replace(/[^0-9.,-]/g, "")) || 0) / 100;
  const n = Number(s.replace(/,/g, ""));
  if (!Number.isFinite(n)) return 0;
  return n > 1 ? n / 100 : n;
}
function parseMonthLabel(label: unknown): string | null {
  const s = String(label ?? "").trim();
  const m = s.match(/([A-Za-zÁÉÍÓÚáéíóú]{3,})[-/\s]?(\d{2,4})/);
  if (!m) return null;
  const mon = MONTHS[m[1].slice(0, 3).toLowerCase()];
  if (!mon) return null;
  let year = parseInt(m[2], 10);
  if (year < 100) year += 2000;
  return `${year}-${String(mon).padStart(2, "0")}`;
}
function ymShift(ym: string, months: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + months, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

interface AprItem {
  itemNumero: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  pvUnit: number;
  pvTotal: number;
  pct: Record<string, number>; // ym → fracción
}

function extractAprobado(cfg: ObraCfg) {
  const wb = XLSX.readFile(cfg.aprobado);
  const ws = wb.Sheets[cfg.aprobadoSheet];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false }) as unknown[][];

  // 1) header row (tiene "Descripción" y "Subtotal")
  let headerRow = -1, descCol = -1, unidadCol = -1, cantCol = -1, punitCol = -1, subtotalCol = -1;
  for (let i = 0; i < Math.min(12, rows.length); i++) {
    const r = rows[i] || [];
    const cells = r.map(norm);
    if (cells.includes("descripción") && cells.some((c) => c === "subtotal")) {
      headerRow = i;
      r.forEach((c, j) => {
        const n = norm(c);
        if (n === "descripción") descCol = j;
        else if (["u", "un", "ud", "unidad"].includes(n)) unidadCol = j;
        else if (n === "cant" || n === "cantidad") cantCol = j;
        else if (n === "p unit" || n === "punit" || n === "p. unit" || n === "p.unit") punitCol = j;
        else if (n === "subtotal") subtotalCol = j;
      });
      break;
    }
  }

  // 2) MES row (cells "MES 0", "MES 1", ...) + month label row (la de arriba)
  let mesRow = -1;
  for (let i = 0; i < Math.min(12, rows.length); i++) {
    if ((rows[i] || []).some((c) => /^mes\s*\d+/i.test(String(c ?? "").trim()))) { mesRow = i; break; }
  }
  const mesCols: { col: number; ordinal: number; ym: string | null }[] = [];
  if (mesRow >= 0) {
    const labelRow = rows[mesRow - 1] || [];
    (rows[mesRow] || []).forEach((c, j) => {
      const m = String(c ?? "").trim().match(/^mes\s*(\d+)/i);
      if (m) mesCols.push({ col: j, ordinal: parseInt(m[1], 10), ym: parseMonthLabel(labelRow[j]) });
    });
    // inferir ym faltantes desde un ancla
    const anchor = mesCols.find((m) => m.ym);
    if (anchor) for (const mc of mesCols) if (!mc.ym) mc.ym = ymShift(anchor.ym!, mc.ordinal - anchor.ordinal);
  }

  // 3) ítems hoja (col0 = nº ítem tipo "1.02"; saltar headers "x.00")
  const items: AprItem[] = [];
  for (let i = (headerRow >= 0 ? headerRow + 1 : 0); i < rows.length; i++) {
    const r = rows[i] || [];
    const itemNumero = String(r[0] ?? "").trim();
    if (!/^\d+\.\d+$/.test(itemNumero) || itemNumero.endsWith(".00")) continue;
    const descripcion = String(r[descCol] ?? "").trim();
    if (!descripcion) continue;
    const cantidad = money(r[cantCol]);
    const pvUnit = money(r[punitCol]);
    const pvTotal = money(r[subtotalCol]);
    const pctMap: Record<string, number> = {};
    for (const mc of mesCols) {
      if (mc.ym == null) continue;
      const p = pct(r[mc.col]);
      if (p > 0) pctMap[mc.ym] = (pctMap[mc.ym] ?? 0) + p;
    }
    items.push({ itemNumero, descripcion, unidad: String(r[unidadCol] ?? "").trim(), cantidad, pvUnit, pvTotal, pct: pctMap });
  }

  const meses = mesCols.filter((m) => m.ym).map((m) => m.ym!) as string[];
  const mesesUnicos = [...new Set(meses)].sort();
  return { headerRow, cols: { descCol, unidadCol, cantCol, punitCol, subtotalCol }, mesRow, meses: mesesUnicos, items };
}

// ---- main ----
for (const cfg of OBRAS) {
  console.log(`\n══════════ ${cfg.code} ══════════`);
  const ap = extractAprobado(cfg);
  console.log(`headerRow=${ap.headerRow} cols=${JSON.stringify(ap.cols)} mesRow=${ap.mesRow}`);
  console.log(`meses (${ap.meses.length}): ${ap.meses.join(", ")}`);
  const conCron = ap.items.filter((i) => Object.keys(i.pct).length > 0);
  const totalPV = ap.items.reduce((s, i) => s + i.pvTotal, 0);
  console.log(`ítems hoja: ${ap.items.length} | con cronograma: ${conCron.length} | Σ precio venta = ${totalPV.toLocaleString("es-AR")}`);
  console.log(`esperado A+B (GGBB): ${cfg.code === "GDR3760" ? "1,345,820,458" : "1,540,610,031"}`);
  // chequeo: suma de % por ítem ≈ 100%
  const malSuma = conCron.filter((i) => { const s = Object.values(i.pct).reduce((a, b) => a + b, 0); return Math.abs(s - 1) > 0.02; });
  console.log(`ítems con Σ% ≠ 100% (>2pp): ${malSuma.length}`);
  console.log("muestra:");
  for (const it of conCron.slice(0, 4)) {
    const s = Object.values(it.pct).reduce((a, b) => a + b, 0);
    console.log(`  ${it.itemNumero} ${it.descripcion.slice(0, 34).padEnd(34)} PV=${it.pvTotal.toLocaleString("es-AR")} Σ%=${(s * 100).toFixed(0)}% → ${Object.entries(it.pct).map(([m, p]) => `${m}:${(p * 100).toFixed(0)}%`).join(" ")}`);
  }
  if (malSuma.length) console.log("  ⚠ ejemplos mal-suma:", malSuma.slice(0, 3).map((i) => `${i.itemNumero}(${(Object.values(i.pct).reduce((a, b) => a + b, 0) * 100).toFixed(0)}%)`).join(", "));

  if (WRITE) {
    // Construir hoja PPTO_APROBADO: venta por ítem + cronograma (% por mes calendario)
    const aoa: unknown[][] = [];
    aoa.push([`PRESUPUESTO APROBADO ${cfg.code} — Precio de venta + Cronograma (% de ejecución por mes)`]);
    aoa.push(["Coeficiente GGBB (K)", cfg.K, "Σ Precio Venta", totalPV, "Fuente", cfg.aprobado.split("/").pop()]);
    aoa.push(["#", "Descripción", "Ud", "Cant", "PV/ud", "PV total", ...ap.meses]);
    for (const it of ap.items) {
      aoa.push([it.itemNumero, it.descripcion, it.unidad, it.cantidad, it.pvUnit, it.pvTotal,
        ...ap.meses.map((m) => (it.pct[m] != null ? it.pct[m] : null))]);
    }
    const newWs = XLSX.utils.aoa_to_sheet(aoa);

    const wb = XLSX.readFile(cfg.unified);
    // idempotente: si ya existe la hoja, reemplazarla
    if (wb.SheetNames.includes("PPTO_APROBADO")) {
      delete wb.Sheets["PPTO_APROBADO"];
      wb.SheetNames = wb.SheetNames.filter((n) => n !== "PPTO_APROBADO");
    }
    XLSX.utils.book_append_sheet(wb, newWs, "PPTO_APROBADO");

    // Fijar el coeficiente GGBB (K) en PPTO_GENERADOR fila 1, col 13 (donde lo lee el import)
    const gen = wb.Sheets["PPTO_GENERADOR"];
    if (gen) gen[XLSX.utils.encode_cell({ r: 1, c: 13 })] = { t: "n", v: cfg.K };

    const out = cfg.unified.replace(/\.xlsx$/i, "_conAprobado.xlsx");
    XLSX.writeFile(wb, out);
    console.log(`✓ escrito: ${out}`);
    console.log(`  hoja PPTO_APROBADO: ${ap.items.length} ítems × ${ap.meses.length} meses · K=${cfg.K}`);
  }
}
console.log(`\n${WRITE ? "MODO ESCRITURA" : "DRY-RUN (sin escribir). Usar --write para generar los archivos."}`);

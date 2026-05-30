/**
 * validate-parser.ts — Compara los Excel de cada obra contra lo que el import dejó en la DB.
 * Número por número, nombre por nombre. NO modifica nada (solo lee).
 *
 * Uso (desde backend/):
 *   npx tsx scripts/validate-parser.ts            # todas las obras
 *   npx tsx scripts/validate-parser.ts GDR3760    # una obra
 *
 * Fuente de verdad = los APU Unificados _conAprobado.xlsx (lo que se importa).
 */
import * as XLSX from "xlsx";
import prisma from "../src/prisma/client";
import { calcCantInsumo } from "../src/lib/composicion";

const DL = "/Users/pablopagliaricci/Downloads";
const OBRAS = [
  { code: "GDR3760", unified: `${DL}/APU_Unificado_GDR3760_VF_conAprobado.xlsx` },
  { code: "CH2171", unified: `${DL}/APU_Unificado_CH2171_v4_4_conAprobado.xlsx` },
];

const arg = process.argv[2];
const targets = arg ? OBRAS.filter((o) => o.code === arg) : OBRAS;

// ── helpers de parseo/comparación ──────────────────────────────────────────────
const num = (v: unknown): number => {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const pct = (v: unknown): number => {
  const s = String(v ?? "").trim(); if (!s) return 0;
  if (s.includes("%")) return (parseFloat(s.replace(/[^0-9.\-]/g, "")) || 0) / 100;
  const n = Number(s.replace(/,/g, "")); return Number.isFinite(n) ? (n > 1 ? n / 100 : n) : 0;
};
const S = (v: unknown) => String(v ?? "").trim();
const readSheet = (wb: XLSX.WorkBook, name: string) =>
  (wb.Sheets[name] ? XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, raw: false }) : []) as unknown[][];

// tolerancias
const MONEY_TOL = 1, MONEY_REL = 0.001, QTY_TOL = 0.01, PCT_TOL = 0.005;
const moneyEq = (a: number, b: number) => Math.abs(a - b) <= MONEY_TOL || (b !== 0 && Math.abs(a - b) / Math.abs(b) <= MONEY_REL);
const qtyEq = (a: number, b: number) => Math.abs(a - b) <= QTY_TOL;
const pctEq = (a: number, b: number) => Math.abs(a - b) <= PCT_TOL;

type Diff = { key: string; campo: string; excel: string | number; db: string | number };
function section(title: string) { console.log(`\n  ── ${title} ──`); }
function report(label: string, total: number, diffs: Diff[], missing: string[], extra: string[]) {
  const ok = total - diffs.length;
  const status = diffs.length === 0 && missing.length === 0 && extra.length === 0 ? "✓" : "✗";
  console.log(`  ${status} ${label}: ${ok}/${total} OK` +
    (diffs.length ? ` · ${diffs.length} difieren` : "") +
    (missing.length ? ` · ${missing.length} faltan en DB` : "") +
    (extra.length ? ` · ${extra.length} sobran en DB` : ""));
  for (const d of diffs.slice(0, 8)) console.log(`      ✗ ${d.key} [${d.campo}] excel=${d.excel} ≠ db=${d.db}`);
  if (diffs.length > 8) console.log(`      … y ${diffs.length - 8} más`);
  for (const m of missing.slice(0, 8)) console.log(`      ⊘ falta en DB: ${m}`);
  for (const e of extra.slice(0, 8)) console.log(`      ⊕ sobra en DB: ${e}`);
}

// ── parseo del PPTO_GENERADOR del unificado ────────────────────────────────────
function parseGenerador(wb: XLSX.WorkBook) {
  const rows = readSheet(wb, "PPTO_GENERADOR");
  const map = new Map<string, { cant: number; cdUd: number; matUd: number; moUd: number; eqUd: number }>();
  for (let i = 3; i < rows.length; i++) {
    const r = rows[i] || []; const item = S(r[0]);
    if (!/^\d+\.\d+$/.test(item)) continue;
    const cant = num(r[4]); if (cant <= 0) continue;
    map.set(item, { cant, matUd: num(r[5]), moUd: num(r[6]), eqUd: num(r[7]), cdUd: num(r[8]) });
  }
  return map;
}

// ── parseo del PPTO_APROBADO del unificado ─────────────────────────────────────
// AGREGADO por item# (la hoja puede repetir un mismo nº de ítem en varias filas — ej. CH
// rubro 24/25). Agregar de forma simétrica al lado DB es la única comparación correcta.
type AprAgg = { cant: number; pvTotal: number; pct: Record<string, number> };
function parseAprobado(wb: XLSX.WorkBook) {
  const rows = readSheet(wb, "PPTO_APROBADO");
  const header = rows[2] ?? [];
  const mesCols: { col: number; ym: string }[] = [];
  for (let c = 6; c < header.length; c++) { const ym = S(header[c]); if (/^\d{4}-\d{2}$/.test(ym)) mesCols.push({ col: c, ym }); }
  const map = new Map<string, AprAgg>();
  const dupCount = new Map<string, number>();
  for (let i = 3; i < rows.length; i++) {
    const r = rows[i] || []; const item = S(r[0]);
    if (!/^\d+\.\d+$/.test(item)) continue;
    dupCount.set(item, (dupCount.get(item) ?? 0) + 1);
    const cant = num(r[3]), pvUnit = num(r[4]);
    const e = map.get(item) ?? { cant: 0, pvTotal: 0, pct: {} };
    e.cant += cant; e.pvTotal += pvUnit * cant;
    for (const m of mesCols) { const p = pct(r[m.col]); if (p > 0) e.pct[m.ym] = (e.pct[m.ym] ?? 0) + p; }
    map.set(item, e);
  }
  const dups = [...dupCount.entries()].filter(([, n]) => n > 1).map(([it]) => it);
  return { items: map, meses: mesCols.map((m) => m.ym), dups };
}

async function validarObra(cfg: { code: string; unified: string }) {
  console.log(`\n═══════════════ ${cfg.code} ═══════════════`);
  const wb = XLSX.readFile(cfg.unified);
  const obra = await prisma.obra.findFirst({ where: { codigo: cfg.code }, select: { id: true, nombre: true } });
  if (!obra) { console.log("  ✗ Obra NO existe en la DB"); return; }
  console.log(`  obra: ${obra.nombre}`);

  // ── GENERADOR ──
  section("Presupuesto GENERADOR (item, cant, CD/ud, MAT/MO/EQ por ud)");
  const gen = parseGenerador(wb);
  const hGen = await prisma.presupuestoHeader.findFirst({ where: { obraId: obra.id, tipo: "GENERADOR" }, select: { id: true } });
  const genDb = hGen ? await prisma.lineaPresupuesto.findMany({ where: { presupuestoHeaderId: hGen.id }, select: { itemNumero: true, cantidad: true, precioUnitarioSnapshot: true, matUd: true, moUd: true, eqUd: true } }) : [];
  const genDbMap = new Map(genDb.map((l) => [l.itemNumero!, l]));
  {
    const diffs: Diff[] = [], missing: string[] = [], extra: string[] = [];
    for (const [item, e] of gen) {
      const d = genDbMap.get(item);
      if (!d) { missing.push(item); continue; }
      if (!qtyEq(e.cant, Number(d.cantidad))) diffs.push({ key: item, campo: "cant", excel: e.cant, db: Number(d.cantidad) });
      if (!moneyEq(e.cdUd, Number(d.precioUnitarioSnapshot))) diffs.push({ key: item, campo: "CD/ud", excel: e.cdUd, db: Number(d.precioUnitarioSnapshot) });
      if (!moneyEq(e.matUd, Number(d.matUd ?? 0))) diffs.push({ key: item, campo: "MAT/ud", excel: e.matUd, db: Number(d.matUd ?? 0) });
      if (!moneyEq(e.moUd, Number(d.moUd ?? 0))) diffs.push({ key: item, campo: "MO/ud", excel: e.moUd, db: Number(d.moUd ?? 0) });
      if (!moneyEq(e.eqUd, Number(d.eqUd ?? 0))) diffs.push({ key: item, campo: "EQ/ud", excel: e.eqUd, db: Number(d.eqUd ?? 0) });
    }
    for (const item of genDbMap.keys()) if (!gen.has(item)) extra.push(item);
    report("líneas generador", gen.size, diffs, missing, extra);
    const cdExcel = [...gen.values()].reduce((s, e) => s + e.cdUd * e.cant, 0);
    const cdDb = genDb.reduce((s, l) => s + Number(l.precioUnitarioSnapshot) * Number(l.cantidad), 0);
    console.log(`     Σ Costo directo: excel=${Math.round(cdExcel).toLocaleString("es-AR")} db=${Math.round(cdDb).toLocaleString("es-AR")} ${moneyEq(cdExcel, cdDb) ? "✓" : "✗"}`);
  }

  // ── APROBADO + cronograma (agregado por item#) ──
  section("Presupuesto APROBADO (item, cant Σ, PV total) + cronograma (% por mes)");
  const { items: apr, dups } = parseAprobado(wb);
  if (dups.length) console.log(`     ⚠ ${dups.length} nº de ítem repetidos en la hoja (se agregan): ${dups.join(", ")}`);
  const hApr = await prisma.presupuestoHeader.findFirst({ where: { obraId: obra.id, tipo: "APROBADO" }, select: { id: true } });
  const aprDb = hApr ? await prisma.lineaPresupuesto.findMany({ where: { presupuestoHeaderId: hApr.id }, select: { itemNumero: true, cantidad: true, precioVenta: true, cronograma: { select: { fecha: true, pctEjecucion: true } } } }) : [];
  // agregar DB por item# (simétrico al Excel)
  const dbAgg = new Map<string, AprAgg>();
  for (const l of aprDb) {
    const it = l.itemNumero ?? ""; const e = dbAgg.get(it) ?? { cant: 0, pvTotal: 0, pct: {} };
    e.cant += Number(l.cantidad); e.pvTotal += Number(l.precioVenta ?? 0) * Number(l.cantidad);
    for (const c of l.cronograma) { const ym = c.fecha.toISOString().slice(0, 7); e.pct[ym] = (e.pct[ym] ?? 0) + Number(c.pctEjecucion); }
    dbAgg.set(it, e);
  }
  {
    const diffs: Diff[] = [], missing: string[] = [], extra: string[] = [];
    for (const [item, e] of apr) {
      const d = dbAgg.get(item);
      if (!d) { missing.push(item); continue; }
      if (!qtyEq(e.cant, d.cant)) diffs.push({ key: item, campo: "cant(Σ)", excel: e.cant, db: d.cant });
      if (!moneyEq(e.pvTotal, d.pvTotal)) diffs.push({ key: item, campo: "PV total", excel: Math.round(e.pvTotal), db: Math.round(d.pvTotal) });
    }
    for (const item of dbAgg.keys()) if (!apr.has(item)) extra.push(item);
    report("ítems aprobado", apr.size, diffs, missing, extra);
    const pvExcel = [...apr.values()].reduce((s, e) => s + e.pvTotal, 0);
    const pvDb = [...dbAgg.values()].reduce((s, e) => s + e.pvTotal, 0);
    console.log(`     Σ Precio venta: excel=${Math.round(pvExcel).toLocaleString("es-AR")} db=${Math.round(pvDb).toLocaleString("es-AR")} ${moneyEq(pvExcel, pvDb) ? "✓" : "✗"}`);

    const cronoDiffs: Diff[] = []; let cronoCeldas = 0;
    for (const [item, e] of apr) {
      const d = dbAgg.get(item); if (!d) continue;
      const yms = new Set([...Object.keys(e.pct), ...Object.keys(d.pct)]);
      for (const ym of yms) { cronoCeldas++; const ex = e.pct[ym] ?? 0, db = d.pct[ym] ?? 0; if (!pctEq(ex, db)) cronoDiffs.push({ key: `${item} ${ym}`, campo: "%mes", excel: ex.toFixed(3), db: db.toFixed(3) }); }
    }
    report("celdas de cronograma (% mes)", cronoCeldas, cronoDiffs, [], []);
  }

  // ── Catálogo (compartido entre obras; precios = último import) ──
  section("Catálogo: conteos + nombres (precio de insumos compartidos = último import)");
  for (const [sheet, tipo] of [["MATERIALES", "MATERIAL"], ["MANO_DE_OBRA", "MANO_DE_OBRA"], ["EQUIPOS", "EQUIPO"], ["SUBCONTRATOS_PRY", "SUBCONTRATO"]] as const) {
    const rows = readSheet(wb, sheet);
    const fileCodes = new Set<string>();
    for (let i = 1; i < rows.length; i++) { const c = S(rows[i]?.[0]); if (c && !/código|codigo|^#/i.test(c)) fileCodes.add(c); }
    const dbCount = await prisma.insumo.count({ where: { tipo } });
    console.log(`     ${sheet}: archivo=${fileCodes.size} filas con código · DB tipo ${tipo}=${dbCount}`);
  }
  const partFile = readSheet(wb, "PARTIDAS").slice(1).filter((r) => S(r?.[0])).length;
  const partDb = await prisma.partida.count();
  const compFile = readSheet(wb, "COMPOSICIÓN").slice(1).filter((r) => S(r?.[0])).length;
  const compDb = await prisma.composicion.count();
  console.log(`     PARTIDAS: archivo≈${partFile} · DB=${partDb} (catálogo global)`);
  console.log(`     COMPOSICIÓN: archivo≈${compFile} filas · DB total=${compDb} (catálogo global)`);

  // ── Sanity / interpretación — candidatos para que Claude juzgue (NO son errores automáticos) ──
  section("Sanity de datos — candidatos a interpretar (¿el número tiene sentido para ESE insumo?)");
  const hS = await prisma.presupuestoHeader.findFirst({ where: { obraId: obra.id, tipo: "APROBADO" }, select: { id: true } });
  const lineasS = hS ? await prisma.lineaPresupuesto.findMany({ where: { presupuestoHeaderId: hS.id }, include: { partida: { include: { composiciones: { include: { insumo: true } } } } } }) : [];
  type InsS ={ desc: string; tipo: string; unidad: string; precio: number; monto: number; cant: number; maxCantUd: number; maxRowUnitCost: number; partidaMax: string };
  const insAgg = new Map<string, InsS>();
  const partCost = new Map<string, { total: number; top: { cod: string; desc: string; monto: number } }>();
  let totalComp = 0;
  for (const l of lineasS) {
    if (!l.partida) continue;
    const rend = l.partida.rendimiento ? Number(l.partida.rendimiento) : null;
    let pTotal = 0; const pTop = { cod: "", desc: "", monto: 0 };
    for (const c of l.partida.composiciones) {
      const cu = Number(c.cantidadPorUnidad);
      const q = calcCantInsumo(c.insumo.tipo, cu, Number(c.pctDesperdicio), rend, Number(l.cantidad));
      const precio = Number(c.insumo.precioReferencia); const m = q * precio;
      totalComp += m; pTotal += m; if (m > pTop.monto) { pTop.cod = c.insumo.codigo; pTop.desc = c.insumo.descripcion; pTop.monto = m; }
      const e = insAgg.get(c.insumo.codigo) ?? { desc: c.insumo.descripcion, tipo: c.insumo.tipo, unidad: c.insumo.unidad, precio, monto: 0, cant: 0, maxCantUd: 0, maxRowUnitCost: 0, partidaMax: "" };
      e.monto += m; e.cant += q;
      const rowU = cu * precio; // costo de este insumo por UNA unidad de la partida
      if (rowU > e.maxRowUnitCost) { e.maxRowUnitCost = rowU; e.maxCantUd = cu; e.partidaMax = l.partida.codigo; }
      insAgg.set(c.insumo.codigo, e);
    }
    const pc = partCost.get(l.partida.codigo) ?? { total: 0, top: { cod: "", desc: "", monto: 0 } };
    pc.total += pTotal; if (pTop.monto > pc.top.monto) pc.top = { ...pTop }; partCost.set(l.partida.codigo, pc);
  }
  const topIns = [...insAgg.entries()].sort((a, b) => b[1].monto - a[1].monto).slice(0, 8);
  console.log("  Top insumos por monto (¿alguno desproporcionado para lo que es?):");
  for (const [cod, e] of topIns)
    console.log(`    ${cod.padEnd(11)} ${e.desc.slice(0, 30).padEnd(30)} ${e.unidad.padEnd(7)} cant=${Math.round(e.cant).toLocaleString("es-AR").padStart(12)} pu=$${Math.round(e.precio).toLocaleString("es-AR")} → $${Math.round(e.monto).toLocaleString("es-AR")} (${(e.monto / (totalComp || 1) * 100).toFixed(1)}%)`);
  // Señal filosa: costo de UN insumo por UNA unidad de partida que es absurdamente grande.
  // (El bug Escalera daba 8192×$274k = $2.200M por m² de tabique.) Un insumo normal aporta a lo
  // sumo cientos de miles por unidad de partida. Umbral $20M = claramente anómalo.
  const EXPLOSIVE = 20_000_000;
  const flags: string[] = [];
  for (const [cod, e] of insAgg)
    if (e.maxRowUnitCost >= EXPLOSIVE)
      flags.push(`💥 ${cod} "${e.desc.trim()}" (${e.unidad}, pu=$${Math.round(e.precio).toLocaleString("es-AR")}): aporta $${Math.round(e.maxRowUnitCost).toLocaleString("es-AR")} por UNA unidad de la partida ${e.partidaMax} (cant/ud=${e.maxCantUd}). ¿Tiene sentido para ese insumo?`);
  for (const [pc, info] of partCost)
    if (info.total > 2_000_000 && info.top.monto / info.total >= 0.9)
      flags.push(`1 insumo = ${(info.top.monto / info.total * 100).toFixed(0)}% del costo de la partida ${pc} — ${info.top.cod} "${info.top.desc.trim()}". ¿Esperable?`);
  if (flags.length === 0) console.log("  ✓ sin candidatos por heurística (revisá igual el top de arriba con criterio)");
  else { console.log(`  🔎 ${flags.length} candidato(s) — interpretá con criterio del rubro:`); for (const f of flags.slice(0, 14)) console.log("     • " + f); if (flags.length > 14) console.log(`     … y ${flags.length - 14} más`); }
}

(async () => {
  console.log("VALIDACIÓN DEL PARSER — Excel vs DB (entorno local). Solo lectura.");
  for (const cfg of targets) await validarObra(cfg);
  console.log("\nListo. ✓ = coincide dentro de tolerancia · ✗ = revisar.");
  await prisma.$disconnect();
  process.exit(0);
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });

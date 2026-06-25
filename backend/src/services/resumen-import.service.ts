/**
 * Importador del "Resumen de Obra" (formato Arquinering v8).
 *
 * Reemplaza al importador del APU_Unificado. Consume SOLO estas hojas:
 *   0_CONFIG       → metadata de obra + ICC base + coeficiente K
 *   0_Indice_CAC   → serie mensual del ICC (valores absolutos) → IndiceICC
 *   1_Composicion  → Insumo (catálogo) + Partida (catálogo) + Composicion + link item↔partida
 *   1_Presupuesto  → Obra + PresupuestoHeader + LineaPresupuesto (con costos y precio de venta)
 *
 * El cronograma mensual NO existe todavía en 1_Presupuesto: cuando se agreguen columnas de
 * meses, `parseCronograma` las detecta y crea las LineaCronograma. Por ahora queda vacío,
 * preservando la lógica de planificación mes a mes intacta.
 *
 * dryRun=true: parsea y valida sin tocar la DB.
 * dryRun=false: upsert idempotente — seguro de correr varias veces.
 */
import * as XLSX from "xlsx";
import prisma from "../prisma/client";
import { categorizeAndPersist } from "./ai/categorizer";
import { isGeminiConfigured } from "./ai/gemini.client";
import { parseResumenObra } from "./resumen-parser.service";
import { persistControlObra, type ControlSummary } from "./control-import.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Row = (string | number | Date | null | undefined)[];

const toStr = (v: unknown): string => (v == null ? "" : String(v).trim());
const toNum = (v: unknown): number => {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

// Serial de Excel (días desde 1899-12-30) → Date UTC. 25569 = días entre 1899-12-30 y 1970-01-01.
function excelSerialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial) || serial < 1) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  return isNaN(d.getTime()) ? null : d;
}

// Celda → Date. Con cellDates:true las celdas formateadas como fecha llegan como Date; las demás
// como número (serial de Excel). Maneja ambos casos + strings ISO.
function cellToDate(v: unknown): Date | null {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  if (typeof v === "number") return excelSerialToDate(v);
  if (typeof v === "string" && v.trim()) {
    const d = new Date(v.trim());
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// Lee una hoja como matriz de filas. raw=true preserva números (fechas como serial, no string).
function readSheet(wb: XLSX.WorkBook, name: string, raw = false): Row[] {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw }) as Row[];
}

// ─── Tipos internos ───────────────────────────────────────────────────────────

type TipoInsumo = "MATERIAL" | "MANO_DE_OBRA" | "EQUIPO" | "SUBCONTRATO";

type InsumoData = {
  codigo: string; descripcion: string; unidad: string;
  precioReferencia: number; tipo: TipoInsumo; categoria?: string;
};

type PartidaData = {
  codigo: string; descripcion: string; rubro: string; unidad: string; rendimiento: number;
};

type ComposicionData = {
  partidaCodigo: string; insumoCodigo: string;
  cantidadPorUnidad: number; pctDesperdicio: number; secuencia: number;
};

type LineaData = {
  itemNumero: string; rubro: string; descripcion: string; unidad: string;
  cantidad: number;
  matUd: number; moUd: number; eqUd: number; cdUd: number; precioVentaUd: number;
  estadoItem: string;
  apuLinkCodigo: string | null;  // código de Partida vinculada (de Cod_Item_Ppto)
  orden: number;
};

type ConfigData = {
  obraNombre: string;
  estado: "EN_PRESUPUESTO" | "EN_CURSO" | "FINALIZADA";
  cacValorBase: number;
  mesCacLabel: string;       // "Diciembre 2024"
  coefGGBB: number;
  fechaInicio: Date | null;
};

type IccPunto = { mes: number; anio: number; valorAbsoluto: number };

export type ResumenImportResult = {
  obra: { nombre: string; codigo: string; estado: string };
  insumos: { total: number; porTipo: Record<string, number> };
  partidas: number;
  composiciones: number;
  presupuesto: {
    coefGGBB: number; cacValor: number; mesCac: string;
    lineas: number; costoDirectoTotal: number; precioVentaTotal: number;
  } | null;
  iccPuntos: number;
  cronogramaFilas: number;
  categorizadas?: number;
  control: ControlSummary;
  obraId?: string;
  presupuestoHeaderId?: string;
  warnings: string[];
  errors: string[];
  dryRun: boolean;
};

// ─── Parsers por hoja ─────────────────────────────────────────────────────────

// Deriva el código de obra del nombre de archivo ("CH_2171_Resumen_de_Obra_v8_11.xlsx" → "CH2171").
// Así coincide con las obras ya importadas vía APU y no se duplican. Fallback: del nombre de obra.
function deriveObraCodigo(filename: string | undefined, obraNombre: string): string {
  if (filename) {
    const base = (filename.split(/[\\/]/).pop() || filename);
    const m = base.match(/^(.+?)_resumen/i);
    if (m) {
      const code = m[1].replace(/[^a-z0-9]/gi, "").toUpperCase();
      if (code) return code;
    }
  }
  return obraNombre.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 24) || "OBRA";
}

/**
 * 0_CONFIG: layout etiqueta (col 0) / valor (col 1). Se lee con raw=true para que las fechas
 * y valores numéricos lleguen como número (serial de Excel), no como string formateado.
 */
function parseConfig(rows: Row[]): ConfigData {
  let obraNombre = "", cacValorBase = 0, coefGGBB = 1;
  let mesBaseDate: Date | null = null, fechaInicio: Date | null = null, estadoRaw = "";

  for (const r of rows) {
    if (!r) continue;
    const label = toStr(r[0]).toLowerCase();
    const val = r[1];
    if (!label) continue;

    if (label.includes("nombre") && label.includes("obra")) obraNombre = toStr(val);
    else if (label === "estado") estadoRaw = toStr(val).toLowerCase();
    else if (label.includes("fecha inicio")) fechaInicio = cellToDate(val);
    else if (label.includes("mes base")) mesBaseDate = cellToDate(val);
    else if (label.includes("valor cac base") || (label.includes("cac") && label.includes("base") && label.includes("valor"))) {
      if (typeof val === "number" && val > 0) cacValorBase = val;
    }
    // "K (Gastos Generales y Beneficios)" — el coeficiente K
    else if (/^k\b/.test(label) || label.includes("gastos generales y benef")) {
      if (typeof val === "number" && val > 0) coefGGBB = val;
    }
  }

  const mesCacLabel = mesBaseDate
    ? `${MESES[mesBaseDate.getUTCMonth()]} ${mesBaseDate.getUTCFullYear()}`
    : "";

  const estado: ConfigData["estado"] =
    /ejecu|curso/.test(estadoRaw) ? "EN_CURSO" :
    /finaliz/.test(estadoRaw) ? "FINALIZADA" : "EN_PRESUPUESTO";

  return { obraNombre, estado, cacValorBase, mesCacLabel, coefGGBB, fechaInicio };
}

/**
 * 0_Indice_CAC: serie mensual del ICC. El header varía entre planillas, así que detectamos las
 * filas de datos por contenido: col 0 = serial de fecha (>40000), col 1 = valor absoluto.
 * Se importan SOLO los valores reales (col 2 "Previsión" vacía); las proyecciones se omiten para
 * no contaminar el "último ICC" que usa el coeficiente.
 */
function parseIndiceCac(rows: Row[]): IccPunto[] {
  // Cota: no importar meses futuros (proyecciones a futuro no son ICC publicado todavía).
  const now = new Date();
  const cota = now.getUTCFullYear() * 12 + now.getUTCMonth(); // año*12+mesIdx del mes actual

  const puntos: IccPunto[] = [];
  for (const r of rows) {
    if (!r) continue;
    const d = cellToDate(r[0]);             // col 0 = mes (Date o serial de Excel)
    const valor = typeof r[1] === "number" ? r[1] : NaN;
    const prevision = r[2];                  // si está poblada, es proyección
    if (!d || d.getUTCFullYear() < 2015) continue;
    if (!Number.isFinite(valor) || valor <= 0) continue;
    if (prevision != null && prevision !== "") continue;        // omitir proyecciones marcadas
    if (d.getUTCFullYear() * 12 + d.getUTCMonth() > cota) continue; // omitir meses futuros
    puntos.push({ mes: d.getUTCMonth() + 1, anio: d.getUTCFullYear(), valorAbsoluto: valor });
  }
  return puntos;
}

const TIPO_MAP: Record<string, TipoInsumo> = {
  MAT: "MATERIAL", MT: "MATERIAL",
  MO: "MANO_DE_OBRA", "MO/ALB": "MANO_DE_OBRA", "MO/OTR": "MANO_DE_OBRA", ALB: "MANO_DE_OBRA",
  EQ: "EQUIPO", EQUIPO: "EQUIPO",
  SUB: "SUBCONTRATO", SC: "SUBCONTRATO", OTR: "SUBCONTRATO",
};

function mapTipoInsumo(tipoRaw: string, subtipo: string, codigo: string): TipoInsumo {
  const t = tipoRaw.toUpperCase().trim();
  if (TIPO_MAP[t]) return TIPO_MAP[t];
  // Heurística por prefijo de código
  const pref = codigo.split("-")[0].toUpperCase();
  if (pref === "MO") return "MANO_DE_OBRA";
  if (pref === "EQ") return "EQUIPO";
  if (subtipo.toUpperCase() === "OTR" || pref === "OTR") return "SUBCONTRATO";
  return "MATERIAL";
}

/**
 * 1_Composicion: cada fila es partida × insumo. Deriva el catálogo de insumos (dedup por código),
 * el catálogo de partidas (códigos distintos + rendimiento), las composiciones, y el mapa
 * item-de-presupuesto → código-de-partida (col 17 "Cod_Item_Ppto").
 *   col 0 Partida | col 1 Tipo | col 2 Subtipo | col 3 Cod_Insumo | col 4 Descripción |
 *   col 5 Unidad | col 6 Cant | col 7 %Desp | col 8 Precio | col 13 Rend.Part | col 17 Cod_Item_Ppto
 */
function parseComposicion(rows: Row[]): {
  insumos: InsumoData[];
  partidas: PartidaData[];
  composiciones: ComposicionData[];
  itemToPartida: Map<string, string>;
} {
  // Detección de columnas por header (robusto ante variantes de layout)
  const header = (rows[0] ?? []).map((c) => toStr(c).toLowerCase());
  const find = (re: RegExp, fallback: number) => {
    const i = header.findIndex((h) => re.test(h));
    return i !== -1 ? i : fallback;
  };
  const C_PART = find(/^partida$/, 0);
  const C_TIPO = find(/^tipo$/, 1);
  const C_SUB = find(/^subtipo$/, 2);
  const C_COD = find(/cod.*insumo/, 3);
  const C_DESC = find(/descrip/, 4);
  const C_UNID = find(/unidad/, 5);
  const C_CANT = find(/^cant/, 6);
  const C_DESP = find(/desp/, 7);
  const C_PREC = find(/^precio$/, 8);
  const C_REND = find(/rend/, 13);
  const C_ITEM = find(/cod.*item|item.*ppto/, 17);

  const insumosMap = new Map<string, InsumoData>();
  const partidaRend = new Map<string, number>();
  const composiciones: ComposicionData[] = [];
  const itemToPartida = new Map<string, string>();
  const seqMap = new Map<string, number>();

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const partidaCodigo = toStr(r[C_PART]);
    const insumoCodigo = toStr(r[C_COD]);
    if (!partidaCodigo || !insumoCodigo) continue;

    // Insumo (dedup por código; última lectura gana precio)
    const tipo = mapTipoInsumo(toStr(r[C_TIPO]), toStr(r[C_SUB]), insumoCodigo);
    insumosMap.set(insumoCodigo, {
      codigo: insumoCodigo,
      descripcion: toStr(r[C_DESC]) || insumoCodigo,
      unidad: toStr(r[C_UNID]) || "u",
      precioReferencia: toNum(r[C_PREC]),
      tipo,
      categoria: toStr(r[C_SUB]) || undefined,
    });

    // Rendimiento de la partida
    if (!partidaRend.has(partidaCodigo)) partidaRend.set(partidaCodigo, toNum(r[C_REND]));

    // Link item-presupuesto → partida (ignorar "-" y vacíos)
    const item = toStr(r[C_ITEM]);
    if (/^\d+\.\d+$/.test(item) && !itemToPartida.has(item)) itemToPartida.set(item, partidaCodigo);

    // Composición
    const seq = (seqMap.get(partidaCodigo) ?? 0) + 1;
    seqMap.set(partidaCodigo, seq);
    composiciones.push({
      partidaCodigo, insumoCodigo,
      cantidadPorUnidad: toNum(r[C_CANT]),
      pctDesperdicio: toNum(r[C_DESP]),
      secuencia: seq,
    });
  }

  // Partidas: código distinto + rendimiento. Descripción/rubro se completan luego con la tarea linkeada.
  const partidas: PartidaData[] = [...partidaRend.keys()].map((codigo) => ({
    codigo,
    descripcion: codigo,
    rubro: "GENERAL",
    unidad: "u",
    rendimiento: partidaRend.get(codigo) ?? 0,
  }));

  return { insumos: [...insumosMap.values()], partidas, composiciones, itemToPartida };
}

/**
 * 1_Presupuesto:
 *   Row 0: título | Row 1: col 15 = coeficiente K | Row 2: headers | Rows 3+: datos
 *     col 5 item# (entero = rubro, N.NN = tarea) | col 6 estado | col 7 Descripción | col 8 Unidad
 *     col 9 Cant | col 10 MT/ud | col 11 MO-OTR/ud | col 12 MO-ALB/ud | col 13 EQ/ud
 *     col 14 Costo Unit (CD/ud) | col 15 P.Unit (precio de venta unitario)
 */
function parsePresupuesto(rows: Row[]): { titulo: string; coefGGBB: number; lineas: LineaData[] } {
  const titulo = toStr(rows[0]?.[0]);
  const coefGGBB = toNum(rows[1]?.[15]) || 0;

  const lineas: LineaData[] = [];
  let rubroActual = "GENERAL";
  let orden = 0;

  for (let i = 3; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const item = toStr(r[5]);
    const desc = toStr(r[7]);
    if (item.toUpperCase() === "TOTAL") break;

    const esEntero = /^\d+(\.0+)?$/.test(item);            // "1", "1.00" (rubro estilo GDR)
    const esTarea = !esEntero && /^\d+\.\d+$/.test(item);  // "1.02", "1.10" (excluye "1.00")

    // Cabecera de rubro: item entero (GDR) o item vacío con descripción (CH pone el rubro en col 7).
    if (esEntero || (!item && desc)) {
      if (desc) rubroActual = desc;
      continue;
    }
    if (!esTarea) continue;
    if (!desc) continue;

    const matUd = toNum(r[10]);
    const moUd = toNum(r[11]) + toNum(r[12]); // MO/OTR + MO/ALB
    const eqUd = toNum(r[13]);
    const cdUd = toNum(r[14]);
    const precioVentaUd = toNum(r[15]);

    lineas.push({
      itemNumero: item, rubro: rubroActual, descripcion: desc,
      unidad: toStr(r[8]) || "u", cantidad: toNum(r[9]),
      matUd, moUd, eqUd, cdUd, precioVentaUd,
      estadoItem: toStr(r[6]) || "OK",
      apuLinkCodigo: null, // se resuelve con itemToPartida afuera
      orden: orden++,
    });
  }

  return { titulo, coefGGBB, lineas };
}

/**
 * Cronograma mensual (planificación). Todavía NO existe en 1_Presupuesto: cuando se agreguen
 * columnas de meses (header con fecha o "YYYY-MM"), esta función las detecta y devuelve, por línea,
 * el % de ejecución por mes. Por ahora no encuentra columnas de meses → devuelve [] y la
 * planificación queda vacía (la lógica de LineaCronograma se mantiene lista para consumirla).
 */
function parseCronograma(
  rows: Row[],
  _itemNumeros: Set<string>,
): { meses: string[]; porItem: Map<string, Record<string, number>> } {
  const header = rows[2] ?? [];
  const mesCols: { col: number; ym: string }[] = [];
  for (let c = 0; c < header.length; c++) {
    const h = header[c];
    let ym = "";
    if (h instanceof Date) ym = `${h.getUTCFullYear()}-${String(h.getUTCMonth() + 1).padStart(2, "0")}`;
    else if (typeof h === "string" && /^\d{4}-\d{2}$/.test(h.trim())) ym = h.trim();
    if (ym) mesCols.push({ col: c, ym });
  }
  if (mesCols.length === 0) return { meses: [], porItem: new Map() };

  const porItem = new Map<string, Record<string, number>>();
  for (let i = 3; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const item = toStr(r[5]);
    if (!/^\d+\.\d+$/.test(item)) continue;
    const pct: Record<string, number> = {};
    for (const m of mesCols) {
      const p = toNum(r[m.col]);
      if (p > 0) pct[m.ym] = (pct[m.ym] ?? 0) + p;
    }
    if (Object.keys(pct).length) porItem.set(item, pct);
  }
  return { meses: mesCols.map((m) => m.ym), porItem };
}

// ─── Bulk upsert (idéntico al importador APU: evita N round-trips) ────────────

async function bulkUpsertInsumos(insumos: InsumoData[]): Promise<void> {
  if (insumos.length === 0) return;
  const CHUNK = 100;
  for (let i = 0; i < insumos.length; i += CHUNK) {
    const chunk = insumos.slice(i, i + CHUNK);
    const params: unknown[] = [];
    for (const ins of chunk) {
      params.push(
        ins.codigo, ins.descripcion, ins.tipo, ins.unidad,
        ins.precioReferencia, null, ins.categoria ?? null, null, null,
      );
    }
    await prisma.$executeRawUnsafe(`
      INSERT INTO "Insumo" (codigo, descripcion, tipo, unidad, "precioReferencia", proveedor, categoria, "codigoOriginal", "fechaCotizacion",
                            embedding, "createdAt", "updatedAt", id)
      VALUES ${chunk.map((_, j) => {
        const b = j * 9;
        return `($${b+1}::text, $${b+2}::text, $${b+3}::"TipoInsumo", $${b+4}::text, $${b+5}::decimal,
                $${b+6}::text, $${b+7}::text, $${b+8}::text, $${b+9}::timestamp,
                ARRAY[]::float8[], NOW(), NOW(), gen_random_uuid())`;
      }).join(", ")}
      ON CONFLICT (codigo) DO UPDATE SET
        descripcion        = EXCLUDED.descripcion,
        tipo               = EXCLUDED.tipo,
        unidad             = EXCLUDED.unidad,
        "precioReferencia" = EXCLUDED."precioReferencia",
        categoria          = EXCLUDED.categoria,
        "updatedAt"        = NOW()
    `, ...params);
  }
}

async function bulkUpsertPartidas(partidas: PartidaData[]): Promise<void> {
  if (partidas.length === 0) return;
  const CHUNK = 100;
  for (let i = 0; i < partidas.length; i += CHUNK) {
    const chunk = partidas.slice(i, i + CHUNK);
    const params: unknown[] = [];
    for (const p of chunk) params.push(p.codigo, p.descripcion, p.rubro, p.unidad, p.rendimiento);
    await prisma.$executeRawUnsafe(`
      INSERT INTO "Partida" (codigo, descripcion, rubro, unidad, rendimiento, tipo, scope, activa, "createdAt", "updatedAt", id)
      VALUES ${chunk.map((_, j) => {
        const b = j * 5;
        return `($${b+1}::text, $${b+2}::text, $${b+3}::text, $${b+4}::text, $${b+5}::decimal,
                'APU'::"TipoPartida", 'APU'::"ScopePartida", true, NOW(), NOW(), gen_random_uuid())`;
      }).join(", ")}
      ON CONFLICT (codigo) DO UPDATE SET
        descripcion = EXCLUDED.descripcion,
        rubro       = EXCLUDED.rubro,
        unidad      = EXCLUDED.unidad,
        rendimiento = EXCLUDED.rendimiento,
        "updatedAt" = NOW()
    `, ...params);
  }
}

// ─── Función principal ────────────────────────────────────────────────────────

export async function importResumenXlsx(
  buf: Buffer,
  opts: { dryRun?: boolean; filename?: string; obraId?: string } = {},
): Promise<ResumenImportResult> {
  const { dryRun = false, filename, obraId: targetObraId } = opts;
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });

  // Parser del control financiero (movimientos, subcontratos, quincenas, gastos, certificaciones,
  // rubros, índices). Aporta además los costos/rubros granulares por línea que la vista de control
  // necesita y que el parse de 1_Presupuesto de acá no captura.
  const extra = parseResumenObra(buf);
  const extraByItem = new Map(extra.lineasPresupuesto.map((l) => [l.itemNumero, l]));

  // 1. Parsear hojas ────────────────────────────────────────────────────────
  const config = parseConfig(readSheet(wb, "0_CONFIG", true));
  const iccPuntos = parseIndiceCac(readSheet(wb, "0_Indice_CAC", true));
  const { insumos, partidas, composiciones, itemToPartida } = parseComposicion(readSheet(wb, "1_Composicion"));
  const presRows = readSheet(wb, "1_Presupuesto");
  const { titulo, coefGGBB: coefDelPpto, lineas } = parsePresupuesto(presRows);

  // Resolver link item→partida y enriquecer la partida con desc/rubro/unidad de su tarea
  const partidaByCodigo = new Map(partidas.map((p) => [p.codigo, p]));
  for (const l of lineas) {
    const partidaCodigo = itemToPartida.get(l.itemNumero) ?? null;
    l.apuLinkCodigo = partidaCodigo;
    if (partidaCodigo) {
      const p = partidaByCodigo.get(partidaCodigo);
      if (p) { p.descripcion = l.descripcion; p.rubro = l.rubro; p.unidad = l.unidad; }
    }
  }

  const coefGGBB = coefDelPpto || config.coefGGBB || 1;
  const obraNombre = config.obraNombre || titulo || "Obra sin nombre";
  const obraCodigo = deriveObraCodigo(filename, obraNombre);

  const cdTotal = lineas.reduce((s, l) => s + l.cdUd * l.cantidad, 0);
  const pvTotal = lineas.reduce((s, l) => s + l.precioVentaUd * l.cantidad, 0);

  // Cronograma (vacío por ahora — columnas de meses aún no existen en 1_Presupuesto)
  const itemSet = new Set(lineas.map((l) => l.itemNumero));
  const crono = parseCronograma(presRows, itemSet);
  const cronogramaFilas = [...crono.porItem.values()].reduce((s, p) => s + Object.keys(p).length, 0);

  // 2. Validaciones ──────────────────────────────────────────────────────────
  const warnings: string[] = [], errors: string[] = [];
  if (insumos.length === 0) errors.push("Hoja 1_Composicion vacía o sin insumos");
  if (lineas.length === 0) errors.push("Hoja 1_Presupuesto sin tareas");
  if (config.cacValorBase <= 0) warnings.push("0_CONFIG: 'Valor CAC base' no encontrado o ≤ 0");
  if (coefGGBB <= 1) warnings.push("Coeficiente K (GGBB) ≤ 1 — revisar 1_Presupuesto!P2 / 0_CONFIG");
  const sinComp = lineas.filter((l) => !l.apuLinkCodigo).length;
  if (sinComp > 0) warnings.push(`${sinComp} tareas sin composición APU (no cotizan / globales / subcontratos)`);
  // Warnings del parser de control (hojas faltantes, filas inválidas, etc.)
  warnings.push(...extra.warnings);

  const porTipo: Record<string, number> = {};
  for (const ins of insumos) porTipo[ins.tipo] = (porTipo[ins.tipo] ?? 0) + 1;

  // Conteo del control financiero (se previsualiza en dry-run; se confirma al persistir).
  const controlPreview: ControlSummary = {
    rubros: extra.rubros.length,
    indicesCAC: extra.indicesCAC.length,
    tarifasUOCRA: extra.tarifasUOCRA.length,
    movimientos: extra.movimientos.length,
    subcontratos: extra.subcontratos.length,
    quincenas: extra.quincenas.length,
    gastosDirInd: extra.gastosDirInd.length,
    contratos: extra.contratos.length,
    certificaciones: extra.certificaciones.length,
    lineasCert: extra.lineasCert.length,
  };

  const result: ResumenImportResult = {
    obra: { nombre: obraNombre, codigo: obraCodigo, estado: config.estado },
    insumos: { total: insumos.length, porTipo },
    partidas: partidas.length,
    composiciones: composiciones.length,
    presupuesto: lineas.length ? {
      coefGGBB, cacValor: config.cacValorBase, mesCac: config.mesCacLabel,
      lineas: lineas.length, costoDirectoTotal: cdTotal, precioVentaTotal: pvTotal,
    } : null,
    iccPuntos: iccPuntos.length,
    cronogramaFilas,
    control: controlPreview,
    warnings, errors, dryRun,
  };

  if (dryRun || errors.length > 0) return result;

  // 3. Persistir catálogo ─────────────────────────────────────────────────────
  await bulkUpsertInsumos(insumos);

  const catalogCodes = new Set(insumos.map((i) => i.codigo));
  if (isGeminiConfigured()) {
    try {
      const sinCategorizar = await prisma.insumo.findMany({
        where: { codigo: { in: [...catalogCodes] }, categoriaCanonica: null },
        select: { codigo: true, descripcion: true, tipo: true, unidad: true, categoria: true },
      });
      if (sinCategorizar.length > 0) result.categorizadas = await categorizeAndPersist(sinCategorizar);
    } catch (err) {
      warnings.push(`Categorización IA omitida: ${(err as Error).message}`);
    }
  }

  await bulkUpsertPartidas(partidas);

  // Composiciones: resolver UUIDs y delete+recrear por partida
  const partidaCodes = new Set(partidas.map((p) => p.codigo));
  const [insumoRows, partidaRows] = await Promise.all([
    prisma.insumo.findMany({ where: { codigo: { in: [...catalogCodes] } }, select: { id: true, codigo: true } }),
    prisma.partida.findMany({ where: { codigo: { in: [...partidaCodes] } }, select: { id: true, codigo: true } }),
  ]);
  const insumoIdMap = new Map(insumoRows.map((r) => [r.codigo, r.id]));
  const partidaIdMap = new Map(partidaRows.map((r) => [r.codigo, r.id]));

  await prisma.composicion.deleteMany({ where: { partidaId: { in: [...partidaIdMap.values()] } } });

  const composicionData = composiciones
    .map((c) => {
      const partidaId = partidaIdMap.get(c.partidaCodigo);
      const insumoId = insumoIdMap.get(c.insumoCodigo);
      if (!partidaId || !insumoId) return null;
      return { partidaId, insumoId, cantidadPorUnidad: c.cantidadPorUnidad, pctDesperdicio: c.pctDesperdicio, secuencia: c.secuencia };
    })
    .filter(Boolean) as { partidaId: string; insumoId: string; cantidadPorUnidad: number; pctDesperdicio: number; secuencia: number }[];

  const COMP_BATCH = 500;
  for (let i = 0; i < composicionData.length; i += COMP_BATCH) {
    await prisma.composicion.createMany({ data: composicionData.slice(i, i + COMP_BATCH) });
  }

  // 4. Serie ICC → IndiceICC (upsert por mes/año) ─────────────────────────────
  for (const p of iccPuntos) {
    await prisma.indiceICC.upsert({
      where: { mes_anio: { mes: p.mes, anio: p.anio } },
      update: { valorAbsoluto: p.valorAbsoluto, fuente: "resumen_obra", fetchedAt: new Date() },
      create: { mes: p.mes, anio: p.anio, valorAbsoluto: p.valorAbsoluto, fuente: "resumen_obra", fetchedAt: new Date() },
    });
  }

  // 5. Obra + Presupuesto ─────────────────────────────────────────────────────
  // Campos derivados del Excel que enriquecen la obra (config + totales del presupuesto).
  const obraData = {
    estado: config.estado,
    fechaInicio: config.fechaInicio,
    coefGGBB,
    mesCacBase: config.mesCacLabel || extra.config.mesCacBase || null,
    valorCacBase: config.cacValorBase || extra.config.valorCacBase || null,
    costoControlable: extra.config.costoControlable ?? cdTotal,
    precioVentaTotal: extra.config.precioVentaTotal ?? pvTotal,
    ...(extra.config.aperturaBlancoP != null ? { aperturaBlancoP: extra.config.aperturaBlancoP } : {}),
    ...(extra.config.aperturaNegrop != null ? { aperturaNegrop: extra.config.aperturaNegrop } : {}),
    ...(extra.config.centroCosto ? { centroCosto: extra.config.centroCosto } : {}),
  };

  // Si se importa apuntando a una obra ya creada (flujo "crear obra → importar resumen"),
  // se respeta su nombre/código y solo se enriquecen los datos. Si no, upsert por código.
  const obra = targetObraId
    ? await prisma.obra.update({ where: { id: targetObraId }, data: obraData })
    : await prisma.obra.upsert({
        where: { codigo: obraCodigo },
        create: { codigo: obraCodigo, nombre: obraNombre, ...obraData },
        update: { nombre: obraNombre, ...obraData },
      });
  result.obraId = obra.id;

  // Reemplazar TODOS los headers previos de la obra (APU viejos incluidos) — import idempotente
  const previos = await prisma.presupuestoHeader.findMany({ where: { obraId: obra.id }, select: { id: true } });
  if (previos.length) {
    await prisma.lineaPresupuesto.deleteMany({ where: { presupuestoHeaderId: { in: previos.map((h) => h.id) } } });
    await prisma.presupuestoHeader.deleteMany({ where: { id: { in: previos.map((h) => h.id) } } });
  }

  // Header único: tipo APROBADO (tiene precio de venta unitario real y hospedará el cronograma)
  const header = await prisma.presupuestoHeader.create({
    data: {
      obraId: obra.id, tipo: "APROBADO", estado: "vigente",
      nombre: `${obraNombre} — Resumen de Obra`,
      mesCac: config.mesCacLabel, cacValor: config.cacValorBase, coefGGBB,
      fecha: new Date(),
      fechaInicio: config.fechaInicio,
    },
  });
  result.presupuestoHeaderId = header.id;

  // Líneas
  const apuCodes = [...new Set(lineas.filter((l) => l.apuLinkCodigo).map((l) => l.apuLinkCodigo!))];
  const apuPartidaMap = new Map(
    apuCodes.length
      ? (await prisma.partida.findMany({ where: { codigo: { in: apuCodes } }, select: { id: true, codigo: true } }))
          .map((p) => [p.codigo, p.id])
      : [],
  );

  await prisma.lineaPresupuesto.createMany({
    data: lineas.map((l) => {
      const partidaId = l.apuLinkCodigo ? (apuPartidaMap.get(l.apuLinkCodigo) ?? null) : null;
      // Costos/rubros/cert granulares desde el parser de control (matcheados por itemNumero).
      // Los consume la vista de control financiero (desvío por rubro, avance físico).
      const g = extraByItem.get(l.itemNumero);
      return {
        obraId: obra.id, presupuestoHeaderId: header.id,
        partidaId,
        descripcionLibre: partidaId ? null : l.descripcion,
        cantidad: l.cantidad,
        precioUnitarioSnapshot: l.cdUd,
        estadoItem: l.estadoItem,
        rubro: l.rubro,
        itemNumero: l.itemNumero,
        orden: l.orden,
        matUd: l.matUd || null, moUd: l.moUd || null, eqUd: l.eqUd || null,
        precioVenta: l.precioVentaUd || null, // precio de venta UNITARIO real (col 15)
        fuente: l.apuLinkCodigo ? "APU" : "PRESUPUESTO",
        apuLinkCodigo: l.apuLinkCodigo,
        tipo: "APU" as const,
        // Granular (control financiero)
        costoMtUd: g?.costoMtUd || null,
        costoMoOtrUd: g?.costoMoOtrUd || null,
        costoMoAlbUd: g?.costoMoAlbUd || null,
        costoEqUd: g?.costoEqUd || null,
        pvMtUd: g?.pvMtUd || null,
        pvMoOtrUd: g?.pvMoOtrUd || null,
        pvMoAlbUd: g?.pvMoAlbUd || null,
        pvEqUd: g?.pvEqUd || null,
        pctCertificado: g?.pctCertificado ? Math.min(99.999999, g.pctCertificado) : null,
        rubroMt: g?.rubroMt || null,
        rubroMoOtr: g?.rubroMoOtr || null,
        rubroMoAlb: g?.rubroMoAlb || null,
        etapa: g?.etapa || null,
      };
    }),
  });

  // 6. Cronograma mensual (vacío hasta que 1_Presupuesto tenga columnas de meses) ──
  if (crono.meses.length && crono.porItem.size) {
    const aprLineas = await prisma.lineaPresupuesto.findMany({
      where: { presupuestoHeaderId: header.id }, select: { id: true, itemNumero: true },
    });
    const lineIdByItem = new Map(aprLineas.map((l) => [l.itemNumero, l.id]));
    const cronoData = [];
    for (const [item, pctByYM] of crono.porItem) {
      const lineaId = lineIdByItem.get(item);
      if (!lineaId) continue;
      for (const [ym, frac] of Object.entries(pctByYM)) {
        const mesOrdinal = crono.meses.indexOf(ym);
        if (mesOrdinal < 0) continue;
        cronoData.push({ lineaId, mesOrdinal, fecha: new Date(`${ym}-01T00:00:00Z`), pctEjecucion: frac });
      }
    }
    const CR_BATCH = 500;
    for (let i = 0; i < cronoData.length; i += CR_BATCH) {
      await prisma.lineaCronograma.createMany({ data: cronoData.slice(i, i + CR_BATCH), skipDuplicates: true });
    }
    result.cronogramaFilas = cronoData.length;
  }

  // 7. Control financiero (movimientos, subcontratos, quincenas, gastos, certificaciones) ──
  try {
    result.control = await persistControlObra(prisma, obra.id, extra);
  } catch (err) {
    // El control es complementario: si algo falla, el import del presupuesto ya quedó hecho.
    warnings.push(`Control financiero parcial: ${(err as Error).message}`);
  }

  return result;
}

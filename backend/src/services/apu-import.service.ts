/**
 * Importador del APU Unificado (formato GDR).
 *
 * Hojas que consume:
 *   MATERIALES       → Insumo (MATERIAL)
 *   MANO_DE_OBRA     → Insumo (MANO_DE_OBRA)
 *   EQUIPOS          → Insumo (EQUIPO)
 *   SUBCONTRATOS_PRY → Insumo (SUBCONTRATO)
 *   PARTIDAS         → Partida (catálogo APU)
 *   COMPOSICIÓN      → Composicion
 *   PPTO_GENERADOR   → Obra + PresupuestoHeader + LineaPresupuesto
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
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false }) as Row[];
}

// ─── Tipos internos ───────────────────────────────────────────────────────────

type TipoInsumo = "MATERIAL" | "MANO_DE_OBRA" | "EQUIPO" | "SUBCONTRATO";

type InsumoData = {
  codigo: string; descripcion: string; unidad: string;
  precioReferencia: number; tipo: TipoInsumo;
  proveedor?: string; categoria?: string; codigoOriginal?: string; fechaCotizacion?: Date;
};

type PartidaData = {
  codigo: string; descripcion: string; rubro: string; unidad: string; rendimiento: number;
};

type ComposicionData = {
  partidaCodigo: string; insumoCodigo: string;
  cantidadPorUnidad: number; pctDesperdicio: number; secuencia: number;
};

type LineaPptoData = {
  itemNumero: string;
  rubro: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  matUd: number; moUd: number; eqUd: number; cdUd: number;
  costoTotal: number;
  precioVenta: number;
  apuLinkCodigo: string | null;  // código de Partida si Fuente=APU
  fuente: string;
  orden: number;
};

export type PptoPreview = {
  titulo: string;
  obraNombre: string;
  obraCodigo: string;
  mesCac: string;
  coefGGBB: number;
  lineas: number;
  costoDirectoTotal: number;
  precioVentaTotal: number;
};

export type ApuImportResult = {
  insumos: { materiales: number; manoDeObra: number; equipos: number; subcontratos: number; total: number };
  partidas: number;
  composiciones: number;
  presupuesto: PptoPreview | null;
  aprobado?: { lineas: number; meses: number; cronogramaFilas: number };
  obraId?: string;
  presupuestoHeaderId?: string;
  warnings: string[];
  errors: string[];
  dryRun: boolean;
};

type AprobadoItem = { itemNumero: string; descripcion: string; unidad: string; cantidad: number; pvUnit: number; pctByYM: Record<string, number> };
type AprobadoData = { meses: string[]; items: AprobadoItem[] };

// ─── Parsers por hoja ─────────────────────────────────────────────────────────

function parseMateriales(rows: Row[]): InsumoData[] {
  return rows.slice(1).filter(r => toStr(r?.[0]) && toStr(r?.[1])).map(r => ({
    codigo: toStr(r![0]), descripcion: toStr(r![1]), unidad: toStr(r![2]) || "u",
    precioReferencia: toNum(r![3]), tipo: "MATERIAL" as const,
    proveedor: toStr(r![4]) || undefined, fechaCotizacion: toDate(r![5]),
    categoria: toStr(r![6]) || undefined, codigoOriginal: toStr(r![7]) || undefined,
  }));
}

function parseManoDeObra(rows: Row[]): InsumoData[] {
  return rows.slice(1).filter(r => toStr(r?.[0]) && toStr(r?.[1])).map(r => ({
    codigo: toStr(r![0]), descripcion: toStr(r![1]), unidad: "jornada",
    precioReferencia: toNum(r![4]) || toNum(r![2]), tipo: "MANO_DE_OBRA" as const,
    categoria: toStr(r![5]) || undefined, codigoOriginal: toStr(r![6]) || undefined,
  }));
}

function parseEquipos(rows: Row[]): InsumoData[] {
  return rows.slice(1).filter(r => toStr(r?.[0]) && toStr(r?.[1])).map(r => ({
    codigo: toStr(r![0]), descripcion: toStr(r![1]), unidad: "día",
    precioReferencia: toNum(r![5]), tipo: "EQUIPO" as const,
    codigoOriginal: toStr(r![6]) || undefined,
  }));
}

function parseSubcontratos(rows: Row[]): InsumoData[] {
  return rows.slice(1).filter(r => toStr(r?.[0]) && toStr(r?.[1])).map(r => ({
    codigo: toStr(r![0]), descripcion: toStr(r![1]), unidad: toStr(r![2]) || "gl",
    precioReferencia: toNum(r![3]), tipo: "SUBCONTRATO" as const,
    categoria: toStr(r![4]) || undefined,
  }));
}

function parsePartidas(rows: Row[]): PartidaData[] {
  return rows.slice(1).filter(r => toStr(r?.[0]) && toStr(r?.[3])).map(r => ({
    codigo: toStr(r![0]), descripcion: toStr(r![3]),
    rubro: toStr(r![2]) || "GENERAL", unidad: toStr(r![4]) || "u", rendimiento: toNum(r![5]),
  }));
}

function parseComposicion(
  rows: Row[], catalogCodes: Set<string>, partidaCodes: Set<string>,
): { data: ComposicionData[]; warnings: string[]; errors: string[] } {
  const warnings: string[] = [], errors: string[] = [], data: ComposicionData[] = [];
  const seqMap = new Map<string, number>();
  const missingInsumos = new Set<string>(), missingPartidas = new Set<string>();

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const partidaCodigo = toStr(r[0]), insumoCodigo = toStr(r[3]);
    const cant = toNum(r[5]), pctDesp = toNum(r[6]);
    if (!partidaCodigo || !insumoCodigo) continue;
    if (!partidaCodes.has(partidaCodigo)) { missingPartidas.add(partidaCodigo); continue; }
    if (!catalogCodes.has(insumoCodigo)) { missingInsumos.add(insumoCodigo); continue; }
    if (cant <= 0) warnings.push(`Fila ${i + 1}: cantidad=${cant} (≤0) para ${partidaCodigo} → ${insumoCodigo}`);
    const seq = (seqMap.get(partidaCodigo) ?? 0) + 1;
    seqMap.set(partidaCodigo, seq);
    data.push({ partidaCodigo, insumoCodigo, cantidadPorUnidad: cant, pctDesperdicio: pctDesp, secuencia: seq });
  }

  if (missingPartidas.size > 0)
    errors.push(`${missingPartidas.size} códigos de partida en COMPOSICIÓN no existen: ${[...missingPartidas].slice(0, 5).join(", ")}…`);
  if (missingInsumos.size > 0)
    errors.push(`${missingInsumos.size} códigos de insumo en COMPOSICIÓN no existen: ${[...missingInsumos].slice(0, 5).join(", ")}…`);

  return { data, warnings, errors };
}

/**
 * PPTO_GENERADOR:
 *   Row 0: título  "PRESUPUESTO GDR 3760 — GENERADOR"
 *   Row 1: mesCac (col 7), coefGGBB (col 13)
 *   Row 2: headers
 *   Rows 3+: data
 *     col 0:  item# (ej "1.02" = tarea, "1" = rubro)
 *     col 1:  Rubro
 *     col 2:  Descripción
 *     col 3:  Unidad
 *     col 4:  Cantidad
 *     col 5:  MAT/ud   col 6: MO/ud   col 7: EQ/ud   col 8: CD/ud
 *     col 12: Costo Total   col 13: Precio Venta
 *     col 16: APU Link (código Partida)
 *     col 18: Fuente ("APU" | "PRESUPUESTO")
 */
function parsePptoGenerador(rows: Row[]): { preview: PptoPreview; lineas: LineaPptoData[] } | null {
  if (rows.length < 4) return null;

  // Título y metadata
  const titulo   = toStr(rows[0]?.[0]);
  const mesCac   = toStr(rows[1]?.[7]) || "";
  const coefGGBB = toNum(rows[1]?.[13]) || 1;

  // Extraer nombre/código de obra del título
  // "PRESUPUESTO GDR 3760 — GENERADOR" → obraNombre="GDR 3760", obraCodigo="GDR3760"
  const tituloMatch = titulo.match(/PRESUPUESTO\s+(.+?)\s*[—–-]/i);
  const obraNombre  = tituloMatch ? tituloMatch[1].trim() : titulo.replace(/PRESUPUESTO\s*/i, "").trim();
  const obraCodigo  = obraNombre.replace(/\s+/g, "").toUpperCase();

  const lineas: LineaPptoData[] = [];
  let rubroActual = "GENERAL";
  let orden = 0;
  let costoTotal = 0, pvTotal = 0;

  for (let i = 3; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const item = toStr(r[0]);
    const desc = toStr(r[2]);
    if (!item || !desc) continue;
    if (item === "TOTAL") break;

    // Rubro: item es entero (ej "1", "2", "3")
    if (/^\d+$/.test(item)) {
      rubroActual = desc;
      continue;
    }

    // Tarea: item tiene decimal (ej "1.02", "3.1")
    if (!/\d+\.\d*/.test(item)) continue;

    const cantidad = toNum(r[4]);
    if (cantidad <= 0) continue;

    const matUd = toNum(r[5]), moUd = toNum(r[6]), eqUd = toNum(r[7]), cdUd = toNum(r[8]);
    const costo = toNum(r[12]);
    const pv    = toNum(r[13]);
    const apuLink = toStr(r[16]) || null;
    const fuente  = toStr(r[18]) || "PRESUPUESTO";

    lineas.push({
      itemNumero: item, rubro: rubroActual, descripcion: desc,
      unidad: toStr(r[3]) || "u", cantidad,
      matUd, moUd, eqUd, cdUd, costoTotal: costo, precioVenta: pv,
      apuLinkCodigo: apuLink, fuente, orden: orden++,
    });
    costoTotal += costo;
    pvTotal    += pv;
  }

  if (lineas.length === 0) return null;

  return {
    preview: { titulo, obraNombre, obraCodigo, mesCac, coefGGBB, lineas: lineas.length, costoDirectoTotal: costoTotal, precioVentaTotal: pvTotal },
    lineas,
  };
}

/**
 * PPTO_APROBADO (hoja agregada por scripts/inject-aprobado.ts):
 *   Row 0: título
 *   Row 1: meta (K en col 1)
 *   Row 2: headers → col0 "#", col1 Descripción, col2 Ud, col3 Cant, col4 PV/ud, col5 PV total,
 *          col 6+: meses en formato YYYY-MM
 *   Rows 3+: por ítem → col0 item#, col4 precio venta unitario, col6+: % de ejecución (fracción) por mes
 * Devuelve los meses (orden de columna = mesOrdinal) y los ítems con su % por mes calendario.
 */
function parsePptoAprobado(rows: Row[]): AprobadoData | null {
  if (rows.length < 4) return null;
  const header = rows[2] ?? [];
  const mesCols: { col: number; ym: string }[] = [];
  for (let c = 6; c < header.length; c++) {
    const ym = toStr(header[c]);
    if (/^\d{4}-\d{2}$/.test(ym)) mesCols.push({ col: c, ym });
  }
  if (mesCols.length === 0) return null;

  const items: AprobadoItem[] = [];
  for (let i = 3; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const itemNumero = toStr(r[0]);
    if (!/^\d+\.\d+$/.test(itemNumero)) continue;
    const pvUnit = toNum(r[4]);
    const pctByYM: Record<string, number> = {};
    for (const m of mesCols) {
      const p = toNum(r[m.col]); // almacenado como fracción (0.33)
      if (p > 0) pctByYM[m.ym] = (pctByYM[m.ym] ?? 0) + p;
    }
    items.push({ itemNumero, descripcion: toStr(r[1]), unidad: toStr(r[2]) || "u", cantidad: toNum(r[3]), pvUnit, pctByYM });
  }
  return { meses: mesCols.map((m) => m.ym), items };
}

// ─── Bulk upsert helpers (evitan N round-trips a Supabase) ───────────────────

/**
 * INSERT INTO "Insumo" (...) VALUES (...), ... ON CONFLICT (codigo) DO UPDATE SET ...
 * Procesado en chunks de 100 para no exceder límites de parámetros.
 */
async function bulkUpsertInsumos(insumos: InsumoData[]): Promise<void> {
  if (insumos.length === 0) return;
  const CHUNK = 100;
  for (let i = 0; i < insumos.length; i += CHUNK) {
    const chunk = insumos.slice(i, i + CHUNK);
    // Build parameterized query
    const placeholders = chunk.map((_, j) => {
      const base = j * 9;
      return `($${base+1}::text, $${base+2}::text, $${base+3}::"TipoInsumo", $${base+4}::text, $${base+5}::decimal, $${base+6}::text, $${base+7}::text, $${base+8}::text, $${base+9}::timestamp)`;
    }).join(", ");
    const params: unknown[] = [];
    for (const ins of chunk) {
      params.push(
        ins.codigo, ins.descripcion, ins.tipo, ins.unidad,
        ins.precioReferencia,
        ins.proveedor ?? null, ins.categoria ?? null,
        ins.codigoOriginal ?? null, ins.fechaCotizacion ?? null,
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
        proveedor          = EXCLUDED.proveedor,
        categoria          = EXCLUDED.categoria,
        "codigoOriginal"   = EXCLUDED."codigoOriginal",
        "fechaCotizacion"  = EXCLUDED."fechaCotizacion",
        "updatedAt"        = NOW()
    `, ...params);
  }
}

/**
 * INSERT INTO "Partida" (...) VALUES (...), ... ON CONFLICT (codigo) DO UPDATE SET ...
 */
async function bulkUpsertPartidas(partidas: PartidaData[]): Promise<void> {
  if (partidas.length === 0) return;
  const CHUNK = 100;
  for (let i = 0; i < partidas.length; i += CHUNK) {
    const chunk = partidas.slice(i, i + CHUNK);
    const params: unknown[] = [];
    for (const p of chunk) {
      params.push(p.codigo, p.descripcion, p.rubro, p.unidad, p.rendimiento);
    }
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

export async function importApuXlsx(buf: Buffer, opts: { dryRun?: boolean } = {}): Promise<ApuImportResult> {
  const { dryRun = false } = opts;
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });

  // 1. Parsear todas las hojas ────────────────────────────────────────────────
  const materiales   = parseMateriales(readSheet(wb, "MATERIALES"));
  const manoDeObra   = parseManoDeObra(readSheet(wb, "MANO_DE_OBRA"));
  const equipos      = parseEquipos(readSheet(wb, "EQUIPOS"));
  const subcontratos = parseSubcontratos(readSheet(wb, "SUBCONTRATOS_PRY"));
  const partidas     = parsePartidas(readSheet(wb, "PARTIDAS"));

  const allInsumos    = [...materiales, ...manoDeObra, ...equipos, ...subcontratos];
  const catalogCodes  = new Set(allInsumos.map(i => i.codigo));
  const partidaCodes  = new Set(partidas.map(p => p.codigo));

  const { data: composiciones, warnings, errors } = parseComposicion(
    readSheet(wb, "COMPOSICIÓN"), catalogCodes, partidaCodes,
  );

  // Presupuesto generador + aprobado (este último con precio de venta + cronograma)
  const pptoResult = parsePptoGenerador(readSheet(wb, "PPTO_GENERADOR"));
  const aprobadoResult = parsePptoAprobado(readSheet(wb, "PPTO_APROBADO"));

  // Validaciones
  if (materiales.length === 0)    errors.push("Hoja MATERIALES vacía o no encontrada");
  if (partidas.length === 0)      errors.push("Hoja PARTIDAS vacía o no encontrada");
  if (composiciones.length === 0) errors.push("Hoja COMPOSICIÓN vacía o no encontrada");
  if (!pptoResult)                errors.push("Hoja PPTO_GENERADOR vacía o no encontrada");

  const result: ApuImportResult = {
    insumos: { materiales: materiales.length, manoDeObra: manoDeObra.length, equipos: equipos.length, subcontratos: subcontratos.length, total: allInsumos.length },
    partidas: partidas.length,
    composiciones: composiciones.length,
    presupuesto: pptoResult?.preview ?? null,
    aprobado: aprobadoResult ? {
      lineas: aprobadoResult.items.length,
      meses: aprobadoResult.meses.length,
      cronogramaFilas: aprobadoResult.items.reduce((s, it) => s + Object.keys(it.pctByYM).length, 0),
    } : undefined,
    warnings, errors, dryRun,
  };

  if (dryRun || errors.length > 0) return result;

  // 2. Persistir catálogo — bulk upsert via SQL nativo (evita N round-trips) ──

  // 2a. Bulk upsert insumos: una sola query INSERT ... ON CONFLICT DO UPDATE
  await bulkUpsertInsumos(allInsumos);

  // 2b. Bulk upsert partidas
  await bulkUpsertPartidas(partidas);

  // 2c. Composiciones: leer UUIDs, delete+recrear por partida
  const [insumoRows, partidaRows] = await Promise.all([
    prisma.insumo.findMany({ where: { codigo: { in: [...catalogCodes] } }, select: { id: true, codigo: true } }),
    prisma.partida.findMany({ where: { codigo: { in: [...partidaCodes] } }, select: { id: true, codigo: true } }),
  ]);
  const insumoIdMap  = new Map(insumoRows.map(r => [r.codigo, r.id]));
  const partidaIdMap = new Map(partidaRows.map(r => [r.codigo, r.id]));

  // Delete todas las composiciones de las partidas afectadas en una query
  await prisma.composicion.deleteMany({
    where: { partidaId: { in: [...partidaIdMap.values()] } },
  });

  // Insertar todas las composiciones en bloques de 500
  const composicionData = composiciones
    .map(c => {
      const partidaId = partidaIdMap.get(c.partidaCodigo);
      const insumoId  = insumoIdMap.get(c.insumoCodigo);
      if (!partidaId || !insumoId) return null;
      return { partidaId, insumoId, cantidadPorUnidad: c.cantidadPorUnidad, pctDesperdicio: c.pctDesperdicio, secuencia: c.secuencia };
    })
    .filter(Boolean) as { partidaId: string; insumoId: string; cantidadPorUnidad: number; pctDesperdicio: number; secuencia: number }[];

  const COMP_BATCH = 500;
  for (let i = 0; i < composicionData.length; i += COMP_BATCH) {
    await prisma.composicion.createMany({ data: composicionData.slice(i, i + COMP_BATCH) });
  }

  // 3. Persistir Obra + Presupuesto ─────────────────────────────────────────
  if (pptoResult) {
    const { preview, lineas } = pptoResult;

    // 3a. Upsert Obra por código
    const obra = await prisma.obra.upsert({
      where:  { codigo: preview.obraCodigo },
      create: { codigo: preview.obraCodigo, nombre: preview.obraNombre, estado: "EN_PRESUPUESTO" },
      update: { nombre: preview.obraNombre },
    });

    // 3b. Presupuesto GENERADOR: reemplazar si existe para esta obra
    const existente = await prisma.presupuestoHeader.findFirst({
      where: { obraId: obra.id, tipo: "GENERADOR" },
      select: { id: true },
    });
    if (existente) {
      await prisma.lineaPresupuesto.deleteMany({ where: { presupuestoHeaderId: existente.id } });
      await prisma.presupuestoHeader.delete({ where: { id: existente.id } });
    }

    const header = await prisma.presupuestoHeader.create({
      data: {
        obraId:   obra.id,
        tipo:     "GENERADOR",
        nombre:   preview.titulo,
        mesCac:   preview.mesCac,
        cacValor: 0,
        coefGGBB: preview.coefGGBB,
        fecha:    new Date(),
      },
    });

    // 3c. Líneas — resolver partidaId desde APU link cuando fuente = APU
    // Obtener todas las partidas referenciadas
    const apuCodes = [...new Set(lineas.filter(l => l.apuLinkCodigo).map(l => l.apuLinkCodigo!))];
    const apuPartidas = apuCodes.length > 0
      ? await prisma.partida.findMany({ where: { codigo: { in: apuCodes } }, select: { id: true, codigo: true } })
      : [];
    const apuPartidaMap = new Map(apuPartidas.map(p => [p.codigo, p.id]));

    await prisma.lineaPresupuesto.createMany({
      data: lineas.map(l => ({
        obraId:                 obra.id,
        presupuestoHeaderId:    header.id,
        partidaId:              l.apuLinkCodigo ? (apuPartidaMap.get(l.apuLinkCodigo) ?? null) : null,
        descripcionLibre:       l.apuLinkCodigo && apuPartidaMap.has(l.apuLinkCodigo) ? null : l.descripcion,
        cantidad:               l.cantidad,
        precioUnitarioSnapshot: l.cdUd,
        rubro:                  l.rubro,
        itemNumero:             l.itemNumero,
        orden:                  l.orden,
        matUd:                  l.matUd || null,
        moUd:                   l.moUd || null,
        eqUd:                   l.eqUd || null,
        // El generador no tiene precio de venta UNITARIO confiable (col "Precio Venta" es un
        // total de línea). Se deja null → el precio de venta se deriva como CD/ud × coefGGBB.
        precioVenta:            null,
        fuente:                 l.fuente,
        apuLinkCodigo:          l.apuLinkCodigo,
        tipo:                   "APU",
      })),
    });

    result.obraId = obra.id;
    result.presupuestoHeaderId = header.id;

    // 3d. Presupuesto APROBADO: espejo de las líneas del generador + precio de venta real
    //     (del aprobado) + cronograma (LineaCronograma por mes). Es la fuente de verdad temporal.
    if (aprobadoResult) {
      const { meses, items } = aprobadoResult;
      // Enriquecimiento desde el generador (costo/ud, MAT/MO/EQ, partida, rubro) por nº de ítem
      const genByItem = new Map(lineas.map((l) => [l.itemNumero, l]));
      const rubroByPrefix = new Map<string, string>();
      for (const l of lineas) {
        const pre = l.itemNumero.split(".")[0];
        if (!rubroByPrefix.has(pre)) rubroByPrefix.set(pre, l.rubro);
      }

      // idempotente: borrar APROBADO previo (cascade borra sus LineaCronograma)
      const exApr = await prisma.presupuestoHeader.findFirst({
        where: { obraId: obra.id, tipo: "APROBADO" }, select: { id: true },
      });
      if (exApr) {
        await prisma.lineaPresupuesto.deleteMany({ where: { presupuestoHeaderId: exApr.id } });
        await prisma.presupuestoHeader.delete({ where: { id: exApr.id } });
      }

      const aprHeader = await prisma.presupuestoHeader.create({
        data: {
          obraId: obra.id, tipo: "APROBADO",
          nombre: `${preview.obraNombre} — APROBADO`,
          mesCac: preview.mesCac, cacValor: 0, coefGGBB: preview.coefGGBB,
          fecha: new Date(),
          fechaInicio: meses.length ? new Date(`${meses[0]}-01T00:00:00Z`) : null,
        },
      });

      // Líneas APROBADO = guiadas por los ítems del aprobado (el presupuesto contractual),
      // enriquecidas con costo/partida/rubro del generador. Así el total de venta es exacto e
      // incluye ítems que el generador no tiene (provisiones, globales, etc.).
      await prisma.lineaPresupuesto.createMany({
        data: items.map((it, idx) => {
          const gen = genByItem.get(it.itemNumero);
          const partidaId = gen?.apuLinkCodigo ? (apuPartidaMap.get(gen.apuLinkCodigo) ?? null) : null;
          const pre = it.itemNumero.split(".")[0];
          return {
            obraId: obra.id, presupuestoHeaderId: aprHeader.id,
            partidaId,
            descripcionLibre: partidaId ? null : it.descripcion,
            cantidad: it.cantidad || 0,
            precioUnitarioSnapshot: gen?.cdUd ?? 0,
            rubro: gen?.rubro ?? rubroByPrefix.get(pre) ?? "GENERAL",
            itemNumero: it.itemNumero,
            orden: gen?.orden ?? (1000 + idx),
            matUd: gen?.matUd || null, moUd: gen?.moUd || null, eqUd: gen?.eqUd || null,
            precioVenta: it.pvUnit || null, // precio de venta UNITARIO aprobado
            fuente: gen?.fuente ?? "APROBADO",
            apuLinkCodigo: gen?.apuLinkCodigo ?? null,
            tipo: "APU" as const,
          };
        }),
      });

      // Recuperar ids de las líneas recién creadas para colgar el cronograma
      const aprLineas = await prisma.lineaPresupuesto.findMany({
        where: { presupuestoHeaderId: aprHeader.id }, select: { id: true, itemNumero: true },
      });
      const lineIdByItem = new Map(aprLineas.map((l) => [l.itemNumero, l.id]));

      const cronoData = [];
      for (const it of items) {
        const lineaId = lineIdByItem.get(it.itemNumero);
        if (!lineaId) continue; // ítem del aprobado sin línea (ej "no cotiza")
        for (const [ym, frac] of Object.entries(it.pctByYM)) {
          const mesOrdinal = meses.indexOf(ym);
          if (mesOrdinal < 0) continue;
          cronoData.push({ lineaId, mesOrdinal, fecha: new Date(`${ym}-01T00:00:00Z`), pctEjecucion: frac });
        }
      }
      const CR_BATCH = 500;
      for (let i = 0; i < cronoData.length; i += CR_BATCH) {
        await prisma.lineaCronograma.createMany({ data: cronoData.slice(i, i + CR_BATCH), skipDuplicates: true });
      }

      result.aprobado = { lineas: aprLineas.length, meses: meses.length, cronogramaFilas: cronoData.length };
    }
  }

  return result;
}

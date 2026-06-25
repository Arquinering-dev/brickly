/**
 * Persistencia del "control financiero" de una obra a partir del Resumen de Obra ya parseado.
 *
 * El parser (resumen-parser.service → parseResumenObra) extrae movimientos, subcontratos,
 * quincenas, gastos, contratos y certificaciones; esta capa los escribe en la DB asociados a
 * la obra. Es idempotente: borra y recrea las entidades de la obra en cada import.
 *
 * Las entidades GLOBALes (RubroContable, IndiceCAC, TarifaUOCRA) se upsertean por su clave
 * única — no se borran, así no se pisan datos de otras obras.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import type { ParsedResumen } from "./resumen-parser.service";

const BATCH = 500;

export type ControlSummary = {
  rubros: number;
  indicesCAC: number;
  tarifasUOCRA: number;
  movimientos: number;
  subcontratos: number;
  quincenas: number;
  gastosDirInd: number;
  contratos: number;
  certificaciones: number;
  lineasCert: number;
};

const emptySummary = (): ControlSummary => ({
  rubros: 0, indicesCAC: 0, tarifasUOCRA: 0, movimientos: 0, subcontratos: 0,
  quincenas: 0, gastosDirInd: 0, contratos: 0, certificaciones: 0, lineasCert: 0,
});

// Clamp para campos Decimal(5,2): máx 999.99. Evita que un % fuera de rango tumbe el insert.
const clamp2 = (n: number) => Math.max(0, Math.min(999.99, n));
// Clamp para campos Decimal(8,6): máx 99.999999 (fracciones de avance/certificación).
const clamp6 = (n: number) => Math.max(0, Math.min(99.999999, n));

async function createInBatches<T>(
  rows: T[],
  fn: (chunk: T[]) => Promise<unknown>,
): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH) {
    await fn(rows.slice(i, i + BATCH));
  }
}

/**
 * Escribe en DB el control financiero de la obra. Devuelve el conteo de filas por entidad.
 * Usar dentro del mismo flujo que importa presupuesto/insumos (ver resumen-import.service).
 */
export async function persistControlObra(
  prisma: PrismaClient,
  obraId: string,
  extra: ParsedResumen,
): Promise<ControlSummary> {
  const summary = emptySummary();

  // ── 1. Borrar lo previo de ESTA obra (idempotencia) ───────────────────────────
  // Orden: movimientos (FK→subcontrato) → subcontratos → quincenas → gastos → contratos
  // (cascada a certificaciones y sus líneas).
  await prisma.movimiento.deleteMany({ where: { obraId } });
  await prisma.subcontratoObra.deleteMany({ where: { obraId } });
  await prisma.quincena.deleteMany({ where: { obraId } });
  await prisma.gastoDirInd.deleteMany({ where: { obraId } });
  await prisma.contratoCliente.deleteMany({ where: { obraId } });

  // ── 2. Catálogos GLOBALes (upsert por clave única) ─────────────────────────────
  for (const r of extra.rubros) {
    await prisma.rubroContable.upsert({
      where: { codigo: r.codigo },
      update: { nombre: r.nombre },
      create: { codigo: r.codigo, nombre: r.nombre },
    });
  }
  summary.rubros = extra.rubros.length;

  for (const ic of extra.indicesCAC) {
    await prisma.indiceCAC.upsert({
      where: { mes: ic.mes },
      update: { valorIndec: ic.valorIndec, esPrevision: ic.esPrevision, ratio: ic.ratio ?? undefined },
      create: { mes: ic.mes, valorIndec: ic.valorIndec, esPrevision: ic.esPrevision, ratio: ic.ratio ?? undefined },
    });
  }
  summary.indicesCAC = extra.indicesCAC.length;

  for (const t of extra.tarifasUOCRA) {
    await prisma.tarifaUOCRA.upsert({
      where: { mes_categoria: { mes: t.mes, categoria: t.categoria } },
      update: { precioDia: t.precioDia },
      create: { mes: t.mes, categoria: t.categoria, precioDia: t.precioDia },
    });
  }
  summary.tarifasUOCRA = extra.tarifasUOCRA.length;

  // Mapa codigo→id de rubros contables, para linkear movimientos
  const rubroRows = await prisma.rubroContable.findMany({ select: { id: true, codigo: true } });
  const rubroIdByCodigo = new Map(rubroRows.map((r) => [r.codigo, r.id]));

  // ── 3. Subcontratos (obra-scoped). contratoId es @unique global ────────────────
  const subcontratoIdByContrato = new Map<string, string>();
  for (const s of extra.subcontratos) {
    const created = await prisma.subcontratoObra.create({
      data: {
        obraId,
        contratoId: s.contratoId,
        proveedor: s.proveedor,
        rubro: s.rubro,
        descripcion: s.descripcion,
        montoPpto: s.montoPpto,
        ajustaCAC: s.ajustaCAC,
        pctAnticipo: s.pctAnticipo != null ? clamp2(s.pctAnticipo) : null,
        pagadoBase: s.pagadoBase,
        pagadoCAC: s.pagadoCAC,
        pagadoCS: s.pagadoCS,
        pagadoTotal: s.pagadoTotal,
        saldo: s.saldo,
        pctConsumido: s.pctConsumido != null ? clamp2(s.pctConsumido) : null,
        estado: s.estado,
      },
      select: { id: true, contratoId: true },
    });
    subcontratoIdByContrato.set(created.contratoId, created.id);
  }
  summary.subcontratos = extra.subcontratos.length;

  // ── 4. Movimientos (link rubro por código, subcontrato por contratoId) ─────────
  const movData: Prisma.MovimientoCreateManyInput[] = extra.movimientos.map((m) => ({
    obraId,
    cuentaCodigo: m.cuentaCodigo,
    cuentaNombre: m.cuentaNombre,
    fecha: m.fecha,
    nroAsiento: m.nroAsiento,
    observaciones: m.observaciones,
    proveedor: m.proveedor,
    codComprobante: m.codComprobante,
    nroComprobante: m.nroComprobante,
    debe: m.debe,
    haber: m.haber,
    centroCosto: m.centroCosto,
    subcontratoId: m.subcontratoId ? (subcontratoIdByContrato.get(m.subcontratoId) ?? null) : null,
    movTipo: m.movTipo,
    rubroContableId: rubroIdByCodigo.get(m.cuentaCodigo) ?? null,
  }));
  await createInBatches(movData, (chunk) => prisma.movimiento.createMany({ data: chunk }));
  summary.movimientos = movData.length;

  // ── 5. Quincenas (dedup por la clave única obraId+mes+periodo+categoria+rubro) ──
  const quinSeen = new Set<string>();
  const quinData: Prisma.QuincenaCreateManyInput[] = [];
  for (const q of extra.quincenas) {
    const key = `${q.mes.toISOString()}|${q.periodo}|${q.categoria}|${q.rubro}`;
    if (quinSeen.has(key)) continue;
    quinSeen.add(key);
    quinData.push({
      obraId, mes: q.mes, periodo: q.periodo, categoria: q.categoria, rubro: q.rubro,
      horasNormales: q.horasNormales, horasExtra50: q.horasExtra50, horasExtra100: q.horasExtra100,
      costoTotal: q.costoTotal, costoDeflactado: q.costoDeflactado,
    });
  }
  await createInBatches(quinData, (chunk) => prisma.quincena.createMany({ data: chunk, skipDuplicates: true }));
  summary.quincenas = quinData.length;

  // ── 6. Gastos directos/indirectos ──────────────────────────────────────────────
  const gastoData: Prisma.GastoDirIndCreateManyInput[] = extra.gastosDirInd.map((g) => ({
    obraId, fecha: g.fecha, tipo: g.tipo, concepto: g.concepto, monto: g.monto,
  }));
  await createInBatches(gastoData, (chunk) => prisma.gastoDirInd.createMany({ data: chunk }));
  summary.gastosDirInd = gastoData.length;

  // ── 7. Contratos cliente → certificaciones → líneas de certificación ───────────
  const certsByOc = new Map<string, ParsedResumen["certificaciones"]>();
  for (const c of extra.certificaciones) {
    const arr = certsByOc.get(c.ocId) ?? [];
    arr.push(c);
    certsByOc.set(c.ocId, arr);
  }
  // líneas agrupadas por certId (el certId es único dentro del Excel)
  const lineasByCert = new Map<string, ParsedResumen["lineasCert"]>();
  for (const l of extra.lineasCert) {
    const arr = lineasByCert.get(l.certId) ?? [];
    arr.push(l);
    lineasByCert.set(l.certId, arr);
  }

  for (const c of extra.contratos) {
    const contrato = await prisma.contratoCliente.create({
      data: {
        obraId,
        ocId: c.ocId,
        descripcion: c.descripcion,
        presupuestoAprobado: c.presupuestoAprobado,
        pctAnticipo: clamp2(c.pctAnticipo),
        mesCacBase: c.mesCacBase,
        indiceCACBase: c.indiceCACBase ?? undefined,
        pctBlanco: clamp2(c.pctBlanco),
        pctNegro: clamp2(c.pctNegro),
        pctDesacopio: clamp2(c.pctDesacopio),
        pctIVA: clamp2(c.pctIVA),
        presupuestoLabel: c.presupuestoLabel,
      },
      select: { id: true },
    });
    summary.contratos++;

    for (const cert of certsByOc.get(c.ocId) ?? []) {
      const created = await prisma.certificacion.create({
        data: {
          contratoId: contrato.id,
          certId: cert.certId,
          fecha: cert.fecha,
          baseBruta: cert.baseBruta,
          pctDesacopio: clamp2(cert.pctDesacopio),
          desacopio: cert.desacopio,
          subtotalNeto: cert.subtotalNeto,
        },
        select: { id: true },
      });
      summary.certificaciones++;

      const lineas = (lineasByCert.get(cert.certId) ?? []).map((l) => ({
        certificacionId: created.id,
        codTarea: l.codTarea,
        pctAnterior: clamp6(l.pctAnterior),
        pctActual: clamp6(l.pctActual),
        pctTotal: clamp6(l.pctTotal),
        pvTotalTarea: l.pvTotalTarea,
        baseCertificada: l.baseCertificada,
        presupuestoLabel: l.presupuestoLabel,
      }));
      if (lineas.length) {
        await createInBatches(lineas, (chunk) => prisma.certificacionLinea.createMany({ data: chunk }));
        summary.lineasCert += lineas.length;
      }
    }
  }

  return summary;
}

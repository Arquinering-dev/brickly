// Certificación de avances armada desde la web.
//
// A fin de mes, alguien (no necesariamente el jefe de obra) arma una certificación para
// cobrarle al comitente. Toma el avance reportado (AvanceReporte) y lo valoriza a PRECIO DE
// VENTA. Reutiliza los modelos Certificacion / CertificacionLinea / ContratoCliente (los mismos
// que llena el import del Resumen), distinguiéndolos con fuente='app' para que el import no los
// borre.
import prisma from "../prisma/client";
import { precioVentaUnitario } from "../lib/pricing";

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export interface LineaComputada {
  lineaId: string;
  itemNumero: string | null;
  descripcion: string;
  unidad: string;
  rubro: string;
  cantidad: number;
  pvTotalTarea: number;   // precio de venta total de la tarea (PV unitario × cantidad)
  pctAnterior: number;    // fracción certificable acumulada antes del mes [0..1]
  pctActual: number;      // fracción avanzada dentro del mes [0..1]
  pctTotal: number;       // clamp(pctAnterior + pctActual)
  baseCertificada: number; // pvTotalTarea × pctActual
}

export interface CertificacionComputada {
  obra: { id: string; nombre: string; codigo: string };
  mes: number;
  anio: number;
  lineas: LineaComputada[];
  total: number;                 // base bruta = Σ (pvTotalTarea × pctActual)
  pctDesacopioSugerido: number;  // fracción 0..1 tomada del contrato (editable por el usuario)
}

/**
 * Calcula (sin persistir) la certificación de avances de una obra para un mes/año:
 * por cada línea con avance en el mes, el % del mes, el % anterior y el monto a PV.
 */
export async function computarCertificacionMes(
  obraId: string,
  mes: number,
  anio: number,
): Promise<CertificacionComputada | null> {
  const obra = await prisma.obra.findUnique({
    where: { id: obraId },
    select: { id: true, nombre: true, codigo: true },
  });
  if (!obra) return null;

  const header = await prisma.presupuestoHeader.findFirst({
    where: { obraId, estado: "vigente" },
    orderBy: { createdAt: "desc" },
    select: { id: true, coefGGBB: true },
  });
  // % desacopio sugerido: del contrato importado (OC real) si existe, sino cualquiera, sino 0.
  // Guardado como fracción 0..1 (ver normalizePct en resumen-parser).
  const contrato =
    (await prisma.contratoCliente.findFirst({
      where: { obraId, fuente: "import" },
      select: { pctDesacopio: true },
    })) ??
    (await prisma.contratoCliente.findFirst({
      where: { obraId },
      select: { pctDesacopio: true },
    }));
  const pctDesacopioSugerido = Number(contrato?.pctDesacopio ?? 0);

  if (!header) return { obra, mes, anio, lineas: [], total: 0, pctDesacopioSugerido };

  // [inicioMes, inicioMesSiguiente)
  const inicioMes = new Date(Date.UTC(anio, mes - 1, 1));
  const inicioMesSig = new Date(Date.UTC(mes === 12 ? anio + 1 : anio, mes === 12 ? 0 : mes, 1));

  const lineas = await prisma.lineaPresupuesto.findMany({
    where: { obraId, presupuestoHeaderId: header.id },
    include: {
      partida: { select: { descripcion: true, unidad: true } },
      avances: { select: { pctIncremento: true, fecha: true } },
    },
    orderBy: [{ orden: "asc" }, { rubro: "asc" }],
  });

  const out: LineaComputada[] = [];
  for (const l of lineas) {
    let antes = 0;
    let actual = 0;
    for (const a of l.avances) {
      const inc = Number(a.pctIncremento);
      if (a.fecha < inicioMes) antes += inc;
      else if (a.fecha < inicioMesSig) actual += inc;
      // avances posteriores al mes no entran en esta certificación
    }
    const pctActual = clamp01(actual);
    if (pctActual <= 0) continue; // solo líneas con avance en el mes

    const pctAnterior = clamp01(antes);
    const pctTotal = clamp01(antes + actual);
    const cantidad = Number(l.cantidad);
    const pvUd = precioVentaUnitario(l.precioVenta, l.precioUnitarioSnapshot, header.coefGGBB);
    const pvTotalTarea = pvUd * cantidad;
    const baseCertificada = pvTotalTarea * pctActual;

    out.push({
      lineaId: l.id,
      itemNumero: l.itemNumero,
      descripcion: l.descripcionLibre ?? l.partida?.descripcion ?? "—",
      unidad: l.partida?.unidad ?? "u",
      rubro: l.rubro || "GENERAL",
      cantidad,
      pvTotalTarea,
      pctAnterior,
      pctActual,
      pctTotal,
      baseCertificada,
    });
  }

  const total = out.reduce((s, l) => s + l.baseCertificada, 0);
  return { obra, mes, anio, lineas: out, total, pctDesacopioSugerido };
}

/**
 * Find-or-create del contrato sintético (fuente='app') de la obra al que cuelgan las
 * certificaciones armadas desde la web. presupuestoAprobado = Σ PV total de las líneas vigentes.
 */
export async function ensureContratoApp(obraId: string): Promise<string> {
  const existing = await prisma.contratoCliente.findUnique({
    where: { obraId_ocId: { obraId, ocId: "APP" } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const header = await prisma.presupuestoHeader.findFirst({
    where: { obraId, estado: "vigente" },
    orderBy: { createdAt: "desc" },
    select: { id: true, coefGGBB: true },
  });

  let presupuestoAprobado = 0;
  if (header) {
    const lineas = await prisma.lineaPresupuesto.findMany({
      where: { obraId, presupuestoHeaderId: header.id },
      select: { cantidad: true, precioVenta: true, precioUnitarioSnapshot: true },
    });
    for (const l of lineas) {
      presupuestoAprobado +=
        precioVentaUnitario(l.precioVenta, l.precioUnitarioSnapshot, header.coefGGBB) * Number(l.cantidad);
    }
  }

  const created = await prisma.contratoCliente.create({
    data: {
      obraId,
      ocId: "APP",
      descripcion: "Certificaciones de avance (web)",
      presupuestoAprobado: presupuestoAprobado.toFixed(2),
      fuente: "app",
    },
    select: { id: true },
  });
  return created.id;
}

// ─── Valorización formal (etapa 'valorizada') ───────────────────────────────────
// Sobre el subtotal conformado (neto de desacopio): redeterminación CAC →
// desdoblamiento facturable / no facturable → IVA sobre el facturable.

export interface ValorizacionInputs {
  subtotal: number;        // base conformada (neto de desacopio)
  pctFacturable: number;   // fracción 0..1
  pctIva: number;          // fracción 0..1, aplica solo al facturable
  indiceCacBase: number;
  indiceCacFecha: number;
}

export interface ValorizacionParte {
  base: number;        // base neta de esta parte
  cac: number;         // monto de redeterminación CAC
  baseConCac: number;  // base + CAC
  iva: number;         // IVA (0 en la parte no facturable)
  total: number;       // baseConCac + IVA
}

export interface Valorizacion {
  ratioCac: number;
  facturable: ValorizacionParte;
  noFacturable: ValorizacionParte;
  totalCac: number;
  total: number;
}

/** Desglose determinístico de la valorización a partir de los inputs. */
export function computarValorizacion(i: ValorizacionInputs): Valorizacion {
  const ratioCac = i.indiceCacBase > 0 ? i.indiceCacFecha / i.indiceCacBase : 1;
  const pctF = clamp01(i.pctFacturable);
  const pctIva = clamp01(i.pctIva);

  const parte = (base: number, conIva: boolean): ValorizacionParte => {
    const cac = base * (ratioCac - 1);
    const baseConCac = base + cac;
    const iva = conIva ? baseConCac * pctIva : 0;
    return { base, cac, baseConCac, iva, total: baseConCac + iva };
  };

  const facturable = parte(i.subtotal * pctF, true);
  const noFacturable = parte(i.subtotal * (1 - pctF), false);
  return {
    ratioCac,
    facturable,
    noFacturable,
    totalCac: facturable.cac + noFacturable.cac,
    total: facturable.total + noFacturable.total,
  };
}

/** Valor del índice CAC para un mes (1° de mes). Rango para evitar problemas de tz. */
async function indiceCacDeMes(mes: number, anio: number): Promise<number | null> {
  const desde = new Date(Date.UTC(anio, mes - 1, 1));
  const hasta = new Date(Date.UTC(mes === 12 ? anio + 1 : anio, mes === 12 ? 0 : mes, 1));
  const row = await prisma.indiceCAC.findFirst({
    where: { mes: { gte: desde, lt: hasta }, esPrevision: false },
    select: { valorIndec: true },
  });
  return row ? Number(row.valorIndec) : null;
}

/**
 * Sugiere los inputs de valorización para una cert: % facturable/IVA del contrato importado
 * (OC real) y los índices CAC base (contrato) y a la fecha (tabla IndiceCAC del mes de la cert).
 */
export async function sugerirValorizacionInputs(
  obraId: string,
  mes: number,
  anio: number,
): Promise<{ pctFacturable: number; pctIva: number; indiceCacBase: number | null; indiceCacFecha: number | null }> {
  const contrato = await prisma.contratoCliente.findFirst({
    where: { obraId, fuente: "import" },
    select: { pctBlanco: true, pctIVA: true, indiceCACBase: true, mesCacBase: true },
  });

  let indiceCacBase: number | null = contrato?.indiceCACBase != null ? Number(contrato.indiceCACBase) : null;
  // Si el contrato no tiene índice base pero sí mes base, buscarlo en la tabla.
  if ((indiceCacBase == null || indiceCacBase === 0) && contrato?.mesCacBase) {
    const d = new Date(contrato.mesCacBase);
    if (!Number.isNaN(d.getTime())) {
      indiceCacBase = await indiceCacDeMes(d.getUTCMonth() + 1, d.getUTCFullYear());
    }
  }

  const indiceCacFecha = await indiceCacDeMes(mes, anio);

  return {
    pctFacturable: contrato?.pctBlanco != null ? Number(contrato.pctBlanco) : 0,
    pctIva: contrato?.pctIVA != null ? Number(contrato.pctIVA) : 0,
    indiceCacBase,
    indiceCacFecha,
  };
}

// ─── Facturación y cobranza (etapa final) ───────────────────────────────────────
export interface ComprobanteInput {
  tipo: string;             // 'factura' | 'recibo' | 'anticipo'
  monto: number;
  fechaCobro: Date | null;
}

export interface Cobranza {
  targetFacturable: number;     // total a facturar del componente facturable (c/IVA)
  targetNoFacturable: number;   // total a documentar del componente no facturable
  total: number;                // total certificación valorizada
  facturado: number;            // Σ comprobantes 'factura'
  documentadoNoFact: number;    // Σ comprobantes 'recibo'
  anticipos: number;            // Σ comprobantes 'anticipo'
  cobrado: number;              // Σ monto con fechaCobro
  saldoFacturar: number;        // targetFacturable − facturado
  saldoNoFacturable: number;    // targetNoFacturable − recibos
  saldoCobrar: number;          // total − cobrado
  estadoSugerido: "facturada" | "cobrada" | null; // según saldos (no baja de valorizada)
}

/** Agrega los comprobantes contra la valorización: facturado/cobrado/saldos + estado sugerido. */
export function computarCobranza(val: Valorizacion | null, comprobantes: ComprobanteInput[]): Cobranza {
  const targetFacturable = val ? val.facturable.total : 0;
  const targetNoFacturable = val ? val.noFacturable.total : 0;
  const total = val ? val.total : 0;
  const sumBy = (pred: (c: ComprobanteInput) => boolean) =>
    comprobantes.filter(pred).reduce((s, c) => s + (Number(c.monto) || 0), 0);

  const facturado = sumBy((c) => c.tipo === "factura");
  const documentadoNoFact = sumBy((c) => c.tipo === "recibo");
  const anticipos = sumBy((c) => c.tipo === "anticipo");
  const cobrado = sumBy((c) => c.fechaCobro != null);

  const EPS = 0.5; // tolerancia de redondeo en pesos
  let estadoSugerido: "facturada" | "cobrada" | null = null;
  if (total > 0) {
    if (cobrado >= total - EPS) estadoSugerido = "cobrada";
    else if (facturado + documentadoNoFact >= total - EPS) estadoSugerido = "facturada";
  }

  return {
    targetFacturable, targetNoFacturable, total,
    facturado, documentadoNoFact, anticipos, cobrado,
    saldoFacturar: Math.max(0, targetFacturable - facturado),
    saldoNoFacturable: Math.max(0, targetNoFacturable - documentadoNoFact),
    saldoCobrar: Math.max(0, total - cobrado),
    estadoSugerido,
  };
}

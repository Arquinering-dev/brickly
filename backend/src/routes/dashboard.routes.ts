import { Router, Request, Response } from "express";
import prisma from "../prisma/client";
import { precioVentaUnitario } from "../lib/pricing";

const router = Router();

// GET /api/dashboard
// Devuelve overview consolidado para la home:
//  - KPIs globales
//  - lista de obras con su estado/avance/alertas
//  - cashflow consolidado (12 meses adelante)
router.get("/", async (_req: Request, res: Response) => {
  try {
    const hoy = new Date();
    const obras = await prisma.obra.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        presupuestos: {
          where: { estado: "vigente" },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    // Por obra: traer datos resumen
    const obrasResumen = await Promise.all(obras.map(async (obra) => {
      // Header preferido: APROBADO > GENERADOR
      const headerAprobado = obra.presupuestos.find((p) => p.tipo === "APROBADO");
      const headerGenerador = obra.presupuestos.find((p) => p.tipo === "GENERADOR");
      const header = headerAprobado ?? headerGenerador;

      if (!header) {
        return {
          id: obra.id,
          nombre: obra.nombre,
          codigo: obra.codigo,
          estado: obra.estado,
          tienePresupuesto: false,
          tieneAprobado: false,
          tieneCronograma: false,
          totalCD: 0,
          totalPV: 0,
          pctAvance: 0,
          mesActualOrdinal: null,
          fechaInicio: null,
          fechaFin: null,
          duracionMeses: 0,
          tareasCount: 0,
          rubrosCount: 0,
          alertas: ["Sin presupuesto cargado"],
        };
      }

      const lineas = await prisma.lineaPresupuesto.findMany({
        where: { presupuestoHeaderId: header.id },
        select: {
          cantidad: true, precioUnitarioSnapshot: true, precioVenta: true, rubro: true,
          cronograma: { select: { fecha: true, pctEjecucion: true, mesOrdinal: true } },
        },
      });

      let totalCD = 0;
      let totalPV = 0;
      const rubros = new Set<string>();
      for (const l of lineas) {
        const cant = Number(l.cantidad);
        totalCD += cant * Number(l.precioUnitarioSnapshot);
        totalPV += cant * precioVentaUnitario(l.precioVenta, l.precioUnitarioSnapshot, header.coefGGBB);
        if (l.rubro) rubros.add(l.rubro);
      }

      // Cronograma agregado
      const fechaSet = new Set<number>();
      let avanceMonto = 0;
      const cashflowMap = new Map<number, number>();
      for (const l of lineas) {
        const cant = Number(l.cantidad);
        const pu = Number(l.precioUnitarioSnapshot);
        const pvUnit = precioVentaUnitario(l.precioVenta, l.precioUnitarioSnapshot, header.coefGGBB);
        for (const c of l.cronograma) {
          fechaSet.add(c.fecha.getTime());
          const pct = Number(c.pctEjecucion);
          if (c.fecha.getTime() <= hoy.getTime()) avanceMonto += cant * pu * pct;
          // Cashflow por mes (precio venta)
          const t = c.fecha.getTime();
          cashflowMap.set(t, (cashflowMap.get(t) ?? 0) + cant * pvUnit * pct);
        }
      }
      const fechasOrdenadas = [...fechaSet].sort((a, b) => a - b);
      const fechaInicio = fechasOrdenadas[0] ?? null;
      const fechaFin = fechasOrdenadas[fechasOrdenadas.length - 1] ?? null;
      const pctAvance = totalCD > 0 ? Math.min(1, avanceMonto / totalCD) : 0;
      const mesesPasados = fechasOrdenadas.filter((f) => f <= hoy.getTime());
      const mesActualOrdinal = mesesPasados.length;

      const alertas: string[] = [];
      if (!headerAprobado) alertas.push("Falta presupuesto aprobado");
      if (fechasOrdenadas.length === 0) alertas.push("Sin cronograma cargado");

      return {
        id: obra.id,
        nombre: obra.nombre,
        codigo: obra.codigo,
        estado: obra.estado,
        tienePresupuesto: true,
        tieneAprobado: !!headerAprobado,
        tieneCronograma: fechasOrdenadas.length > 0,
        totalCD,
        totalPV,
        pctAvance,
        mesActualOrdinal,
        fechaInicio: fechaInicio ? new Date(fechaInicio).toISOString() : null,
        fechaFin: fechaFin ? new Date(fechaFin).toISOString() : null,
        duracionMeses: fechasOrdenadas.length,
        tareasCount: lineas.length,
        rubrosCount: rubros.size,
        alertas,
        cashflowSerie: [...cashflowMap.entries()].sort(([a], [b]) => a - b).map(([t, monto]) => ({
          fecha: new Date(t).toISOString(),
          monto,
        })),
      };
    }));

    // Cashflow consolidado: mismo mes (YYYY-MM) sumado entre obras
    const cashflowConsolidado = new Map<string, { mes: string; fecha: string; total: number; porObra: Record<string, number> }>();
    for (const o of obrasResumen) {
      if (!o.cashflowSerie) continue;
      for (const p of o.cashflowSerie) {
        const mes = p.fecha.slice(0, 7); // YYYY-MM
        const entry = cashflowConsolidado.get(mes) ?? { mes, fecha: p.fecha, total: 0, porObra: {} };
        entry.total += p.monto;
        entry.porObra[o.codigo] = (entry.porObra[o.codigo] ?? 0) + p.monto;
        cashflowConsolidado.set(mes, entry);
      }
    }
    const cashflow = [...cashflowConsolidado.values()].sort((a, b) => a.mes.localeCompare(b.mes));

    // KPIs globales
    const obrasActivas = obrasResumen.filter((o) => o.estado === "EN_CURSO").length;
    const obrasEnPpto = obrasResumen.filter((o) => o.estado === "EN_PRESUPUESTO").length;
    const obrasFinalizadas = obrasResumen.filter((o) => o.estado === "FINALIZADA").length;
    const totalCarteraPV = obrasResumen.reduce((s, o) => s + o.totalPV, 0);
    const pctAvancePromedio = obrasResumen.length > 0
      ? obrasResumen.reduce((s, o) => s + o.pctAvance, 0) / obrasResumen.length
      : 0;

    // Facturación proyectada este mes
    const mesActual = hoy.toISOString().slice(0, 7);
    const cfMes = cashflow.find((c) => c.mes === mesActual);
    const facturacionMesProyectada = cfMes?.total ?? 0;

    // Obras con alertas (necesita atención)
    const obrasAtencion = obrasResumen.filter((o) => o.alertas.length > 0).map((o) => ({
      id: o.id, nombre: o.nombre, codigo: o.codigo, estado: o.estado, alertas: o.alertas,
    }));

    res.json({
      kpis: {
        obrasActivas,
        obrasEnPpto,
        obrasFinalizadas,
        obrasTotal: obrasResumen.length,
        totalCarteraPV,
        pctAvancePromedio,
        facturacionMesProyectada,
      },
      obras: obrasResumen.map(({ cashflowSerie, ...rest }) => { void cashflowSerie; return rest; }),
      cashflow,
      obrasAtencion,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al obtener dashboard" });
  }
});

export default router;

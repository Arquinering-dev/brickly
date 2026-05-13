import { Router, Request, Response } from "express";
import prisma from "../prisma/client";

const router = Router();

// Cantidad consumida del insumo para una línea de presupuesto.
// MO/EQ: días = (cantPorUd / rendimiento) × cantLínea  — rendimiento viene de PARTIDAS (unidades de partida / día).
// MAT/SUB: cantPorUd × (1+pctDesp) × cantLínea
function calcCantInsumo(
  tipoInsumo: string,
  cantidadPorUnidad: number,
  pctDesperdicio: number,
  rendimiento: number | null | undefined,
  cantLinea: number
): number {
  if (tipoInsumo === "MANO_DE_OBRA" || tipoInsumo === "EQUIPO") {
    const rend = Number(rendimiento) || 0;
    if (rend > 0) return (cantidadPorUnidad / rend) * cantLinea;
    return cantidadPorUnidad * cantLinea;
  }
  return cantidadPorUnidad * (1 + pctDesperdicio) * cantLinea;
}

router.get("/", async (_req: Request, res: Response) => {
  try {
    const obras = await prisma.obra.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { presupuestos: true } } },
    });
    res.json(obras);
  } catch {
    res.status(500).json({ error: "Error al listar obras" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const { nombre, codigo, fechaInicio, estado } = req.body;
    if (!nombre || !codigo) {
      res.status(400).json({ error: "nombre y codigo son requeridos" });
      return;
    }
    const obra = await prisma.obra.create({
      data: {
        nombre,
        codigo,
        fechaInicio: fechaInicio ? new Date(fechaInicio) : null,
        estado: estado ?? "EN_PRESUPUESTO",
      },
    });
    res.status(201).json(obra);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error interno" });
  }
});

router.get("/:id/presupuesto", async (req: Request, res: Response) => {
  try {
    const obra = await prisma.obra.findUnique({ where: { id: req.params.id } });
    if (!obra) {
      res.status(404).json({ error: "Obra no encontrada" });
      return;
    }

    const header = await prisma.presupuestoHeader.findFirst({
      where: { obraId: obra.id, estado: "vigente" },
      orderBy: { createdAt: "desc" },
    });

    const lineas = await prisma.lineaPresupuesto.findMany({
      where: { obraId: obra.id, presupuestoHeaderId: header?.id },
      include: {
        partida: {
          include: {
            composiciones: {
              include: { insumo: true },
              orderBy: { secuencia: "asc" },
            },
          },
        },
      },
      orderBy: [{ orden: "asc" }, { rubro: "asc" }],
    });

    // Group by rubro preserving order of first appearance
    const rubrosMap = new Map<
      string,
      {
        nombre: string;
        totalMat: number;
        totalMO: number;
        totalEQ: number;
        totalPV: number;
        totalRubro: number;
        lineas: unknown[];
      }
    >();

    let totalMat = 0;
    let totalMO = 0;
    let totalEQ = 0;
    let totalGeneral = 0;
    let totalPV = 0;

    for (const linea of lineas) {
      const rubro = linea.rubro || "GENERAL";
      if (!rubrosMap.has(rubro)) {
        rubrosMap.set(rubro, { nombre: rubro, totalMat: 0, totalMO: 0, totalEQ: 0, totalPV: 0, totalRubro: 0, lineas: [] });
      }
      const g = rubrosMap.get(rubro)!;

      const cant = Number(linea.cantidad);
      const precioUnit = Number(linea.precioUnitarioSnapshot);
      const total = cant * precioUnit;
      const pv = linea.precioVenta ? Number(linea.precioVenta) : 0;

      // Use stored MAT/MO/EQ/ud * cant if available (from unified import)
      // Otherwise compute from APU composition
      let lineMat = 0;
      let lineMO = 0;
      let lineEQ = 0;

      if (linea.matUd !== null || linea.moUd !== null || linea.eqUd !== null) {
        lineMat = Number(linea.matUd ?? 0) * cant;
        lineMO = Number(linea.moUd ?? 0) * cant;
        lineEQ = Number(linea.eqUd ?? 0) * cant;
      } else if (linea.partida?.composiciones.length) {
        const rend = linea.partida.rendimiento ? Number(linea.partida.rendimiento) : null;
        for (const comp of linea.partida.composiciones) {
          const cantInsumo = calcCantInsumo(
            comp.insumo.tipo,
            Number(comp.cantidadPorUnidad),
            Number(comp.pctDesperdicio),
            rend,
            cant
          );
          const compCost = cantInsumo * Number(comp.insumo.precioReferencia);
          if (comp.insumo.tipo === "MATERIAL") lineMat += compCost;
          else if (comp.insumo.tipo === "MANO_DE_OBRA") lineMO += compCost;
          else if (comp.insumo.tipo === "EQUIPO") lineEQ += compCost;
        }
      }

      g.totalMat += lineMat;
      g.totalMO += lineMO;
      g.totalEQ += lineEQ;
      g.totalRubro += total;
      g.totalPV += pv;
      totalMat += lineMat;
      totalMO += lineMO;
      totalEQ += lineEQ;
      totalGeneral += total;
      totalPV += pv;

      g.lineas.push({
        id: linea.id,
        itemNumero: linea.itemNumero ?? null,
        descripcion: linea.partida?.descripcion ?? linea.descripcionLibre ?? "",
        unidad: linea.partida?.unidad ?? "",
        cantidad: cant,
        matUd: linea.matUd !== null ? Number(linea.matUd) : null,
        moUd: linea.moUd !== null ? Number(linea.moUd) : null,
        eqUd: linea.eqUd !== null ? Number(linea.eqUd) : null,
        precioUnitario: precioUnit,
        precioVenta: linea.precioVenta !== null ? Number(linea.precioVenta) : null,
        total,
        matTotal: lineMat,
        moTotal: lineMO,
        eqTotal: lineEQ,
        tipo: linea.tipo,
        fuente: linea.fuente ?? null,
        estadoItem: linea.estadoItem,
        partidaId: linea.partidaId,
        apuLinkCodigo: linea.apuLinkCodigo ?? null,
        composicion: linea.partida?.composiciones.map((c) => {
          const rend = linea.partida?.rendimiento ? Number(linea.partida.rendimiento) : null;
          const cantTotal = calcCantInsumo(
            c.insumo.tipo,
            Number(c.cantidadPorUnidad),
            Number(c.pctDesperdicio),
            rend,
            cant
          );
          return {
            insumo: c.insumo.descripcion,
            codigo: c.insumo.codigo,
            tipo: c.insumo.tipo,
            unidad: c.insumo.unidad,
            cantidadPorUnidad: Number(c.cantidadPorUnidad),
            pctDesperdicio: Number(c.pctDesperdicio),
            precioReferencia: Number(c.insumo.precioReferencia),
            cantidadTotal: cantTotal,
            costoTotal: cantTotal * Number(c.insumo.precioReferencia),
          };
        }) ?? [],
      });
    }

    res.json({
      obra: { id: obra.id, nombre: obra.nombre, codigo: obra.codigo },
      presupuesto: header ? {
        id: header.id,
        nombre: header.nombre ?? null,
        version: header.version ?? null,
        mesCac: header.mesCac,
        coefGGBB: header.coefGGBB ? Number(header.coefGGBB) : null,
      } : null,
      cacValor: header ? Number(header.cacValor) : null,
      mesCac: header?.mesCac ?? null,
      totalMat,
      totalMO,
      totalEQ,
      totalGeneral,
      totalPV,
      rubros: Array.from(rubrosMap.values()),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al obtener presupuesto" });
  }
});

router.get("/:id/planificacion", async (req: Request, res: Response) => {
  try {
    const obra = await prisma.obra.findUnique({ where: { id: req.params.id } });
    if (!obra) { res.status(404).json({ error: "Obra no encontrada" }); return; }

    const pctAvance = Math.min(1, Math.max(0, parseFloat(req.query.pct as string ?? "1") || 1));
    const rubroParam = req.query.rubro as string | undefined;

    // Get the latest vigente header
    const header = await prisma.presupuestoHeader.findFirst({
      where: { obraId: obra.id, estado: "vigente" },
      orderBy: { createdAt: "desc" },
    });

    // All distinct rubros for this obra
    const rubroRows = await prisma.lineaPresupuesto.findMany({
      where: { obraId: obra.id, ...(header ? { presupuestoHeaderId: header.id } : {}) },
      select: { rubro: true },
      distinct: ["rubro"],
      orderBy: { rubro: "asc" },
    });
    const rubros = rubroRows.map((r) => r.rubro).filter(Boolean);

    const incluirTodo = req.query.all === "1" || req.query.all === "true";

    if (!rubroParam && !incluirTodo) {
      res.json({ obra: { id: obra.id, nombre: obra.nombre, codigo: obra.codigo }, rubros, rubro: null });
      return;
    }

    // Lines for selected rubro (or all if incluirTodo)
    const lineas = await prisma.lineaPresupuesto.findMany({
      where: {
        obraId: obra.id,
        ...(rubroParam ? { rubro: rubroParam } : {}),
        ...(header ? { presupuestoHeaderId: header.id } : {}),
      },
      include: {
        partida: {
          include: {
            composiciones: {
              include: { insumo: true },
              orderBy: { secuencia: "asc" },
            },
          },
        },
      },
      orderBy: { orden: "asc" },
    });

    // Aggregate by insumo codigo
    type AggrEntry = {
      codigo: string;
      descripcion: string;
      tipo: string;
      unidad: string;
      categoria: string | null;
      cantidadTotal: number;
      precioUnitario: number;
      costoTotal: number;
    };

    const aggrMap = new Map<string, AggrEntry>();
    let lineasSinComposicion = 0;
    let totalCDPpto = 0;

    for (const linea of lineas) {
      const cant = Number(linea.cantidad) * pctAvance;
      totalCDPpto += Number(linea.precioUnitarioSnapshot) * Number(linea.cantidad) * pctAvance;

      if (!linea.partida || linea.partida.composiciones.length === 0) {
        lineasSinComposicion++;
        continue;
      }

      const rend = linea.partida.rendimiento ? Number(linea.partida.rendimiento) : null;
      for (const comp of linea.partida.composiciones) {
        const ins = comp.insumo;
        const cantInsumo = calcCantInsumo(
          ins.tipo,
          Number(comp.cantidadPorUnidad),
          Number(comp.pctDesperdicio),
          rend,
          cant
        );
        const costoInsumo = cantInsumo * Number(ins.precioReferencia);

        if (aggrMap.has(ins.codigo)) {
          const e = aggrMap.get(ins.codigo)!;
          e.cantidadTotal += cantInsumo;
          e.costoTotal += costoInsumo;
        } else {
          aggrMap.set(ins.codigo, {
            codigo: ins.codigo,
            descripcion: ins.descripcion,
            tipo: ins.tipo,
            unidad: ins.unidad,
            categoria: ins.categoria ?? null,
            cantidadTotal: cantInsumo,
            precioUnitario: Number(ins.precioReferencia),
            costoTotal: costoInsumo,
          });
        }
      }
    }

    const all = Array.from(aggrMap.values()).sort((a, b) => b.costoTotal - a.costoTotal);

    const materiales = all.filter((e) => e.tipo === "MATERIAL");
    const manoDeObra = all.filter((e) => e.tipo === "MANO_DE_OBRA");
    const equipos = all.filter((e) => e.tipo === "EQUIPO");
    const subcontratos = all.filter((e) => e.tipo === "SUBCONTRATO");

    const sum = (arr: AggrEntry[]) => arr.reduce((s, e) => s + e.costoTotal, 0);

    res.json({
      obra: { id: obra.id, nombre: obra.nombre, codigo: obra.codigo },
      rubros,
      rubro: rubroParam ?? null,
      pctAvance,
      lineasTotal: lineas.length,
      lineasSinComposicion,
      materiales,
      manoDeObra,
      equipos,
      subcontratos,
      resumen: {
        totalMat: sum(materiales),
        totalMO: sum(manoDeObra),
        totalEQ: sum(equipos),
        totalSub: sum(subcontratos),
        totalCD: sum(all),
        totalCDPpto,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al planificar etapa" });
  }
});

export default router;

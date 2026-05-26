import { Router, Request, Response } from "express";
import prisma from "../prisma/client";

const router = Router();

// Multiplicador fijo para precio de venta (GG+GS+Utilidad).
// No se parsea del Excel — siempre se aplica este factor sobre el costo directo.
const MARKUP_FACTOR = 1.3327;

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

// Resumen liviano de todos los presupuestos vigentes — para la vista general
router.get("/presupuestos/resumen", async (_req: Request, res: Response) => {
  try {
    const obras = await prisma.obra.findMany({ orderBy: { createdAt: "desc" } });

    const resumen = await Promise.all(
      obras.map(async (obra) => {
        const header = await prisma.presupuestoHeader.findFirst({
          where: { obraId: obra.id, estado: "vigente" },
          orderBy: { createdAt: "desc" },
        });

        if (!header) {
          return {
            obraId: obra.id,
            obraNombre: obra.nombre,
            obraCodigo: obra.codigo,
            obraEstado: obra.estado,
            tienePresupuesto: false,
            presupuestoNombre: null,
            mesCac: null,
            version: null,
            coefGGBB: null,
            totalGeneral: 0,
            totalPV: 0,
            rubrosCount: 0,
            tareasCount: 0,
          };
        }

        const agg = await prisma.lineaPresupuesto.aggregate({
          where: { obraId: obra.id, presupuestoHeaderId: header.id },
          _count: { id: true },
        });

        // total CD = sum(precioUnitarioSnapshot * cantidad)
        const lineas = await prisma.lineaPresupuesto.findMany({
          where: { obraId: obra.id, presupuestoHeaderId: header.id },
          select: { precioUnitarioSnapshot: true, cantidad: true, rubro: true },
        });

        let totalGeneral = 0;
        const rubrosSet = new Set<string>();
        for (const l of lineas) {
          totalGeneral += Number(l.precioUnitarioSnapshot) * Number(l.cantidad);
          if (l.rubro) rubrosSet.add(l.rubro);
        }

        // Precio de venta siempre = costo directo × MARKUP_FACTOR (no se lee del Excel)
        const totalPV = totalGeneral * MARKUP_FACTOR;

        return {
          obraId: obra.id,
          obraNombre: obra.nombre,
          obraCodigo: obra.codigo,
          obraEstado: obra.estado,
          tienePresupuesto: true,
          presupuestoNombre: header.nombre,
          mesCac: header.mesCac,
          version: header.version,
          coefGGBB: header.coefGGBB ? Number(header.coefGGBB) : null,
          totalGeneral,
          totalPV,
          rubrosCount: rubrosSet.size,
          tareasCount: agg._count.id,
        };
      })
    );

    res.json(resumen);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al obtener resumen" });
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

    type InsumoAgg = {
      codigo: string;
      descripcion: string;
      tipo: string;
      unidad: string;
      categoria: string | null;
      cantidad: number;
      fuenteCategoria: string | null;
    };

    // Group by rubro preserving order of first appearance
    const rubrosMap = new Map<
      string,
      {
        nombre: string;
        normalizado: boolean;   // true si la IA renombró este rubro al importar
        totalMat: number;
        totalMO: number;
        totalEQ: number;
        totalPV: number;
        totalRubro: number;
        // Insumos agregados a nivel de rubro (consumo total de todas las tareas)
        insumosMap: Map<string, InsumoAgg>;
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
        rubrosMap.set(rubro, {
          nombre: rubro,
          normalizado: linea.rubroNormalizado ?? false,
          totalMat: 0, totalMO: 0, totalEQ: 0, totalPV: 0, totalRubro: 0,
          insumosMap: new Map<string, InsumoAgg>(),
          lineas: [],
        });
      } else if (linea.rubroNormalizado) {
        rubrosMap.get(rubro)!.normalizado = true;
      }
      const g = rubrosMap.get(rubro)!;

      const cant = Number(linea.cantidad);
      const precioUnit = Number(linea.precioUnitarioSnapshot);
      const total = cant * precioUnit;
      // Precio de venta siempre calculado — MARKUP_FACTOR aplicado sobre costo directo
      const pv = total * MARKUP_FACTOR;

      // Cálculo de costos por tipo: usa los valores almacenados si existen, sino calcula desde composición.
      let lineMat = 0;
      let lineMO = 0;
      let lineEQ = 0;

      if (linea.matUd !== null || linea.moUd !== null || linea.eqUd !== null) {
        lineMat = Number(linea.matUd ?? 0) * cant;
        lineMO = Number(linea.moUd ?? 0) * cant;
        lineEQ = Number(linea.eqUd ?? 0) * cant;
      }

      // Agregar insumos al rubro: SIEMPRE iterar composiciones cuando existan,
      // independientemente del cálculo de costos. Esto nos da el desglose físico
      // (horas de oficial, kg de cemento, etc.) por rubro.
      if (linea.partida?.composiciones.length) {
        const rend = linea.partida.rendimiento ? Number(linea.partida.rendimiento) : null;
        for (const comp of linea.partida.composiciones) {
          const cantInsumo = calcCantInsumo(
            comp.insumo.tipo,
            Number(comp.cantidadPorUnidad),
            Number(comp.pctDesperdicio),
            rend,
            cant
          );

          // Acumular en insumosMap del rubro
          const key = comp.insumo.codigo;
          const existing = g.insumosMap.get(key);
          if (existing) {
            existing.cantidad += cantInsumo;
          } else {
            g.insumosMap.set(key, {
              codigo: comp.insumo.codigo,
              descripcion: comp.insumo.descripcion,
              tipo: comp.insumo.tipo,
              unidad: comp.insumo.unidad,
              categoria: comp.insumo.categoria ?? null,
              cantidad: cantInsumo,
              fuenteCategoria: (comp.insumo as { fuenteCategoria?: string | null }).fuenteCategoria ?? null,
            });
          }

          // Si no había costos almacenados, calcular desde composición
          if (linea.matUd === null && linea.moUd === null && linea.eqUd === null) {
            const compCost = cantInsumo * Number(comp.insumo.precioReferencia);
            if (comp.insumo.tipo === "MATERIAL") lineMat += compCost;
            else if (comp.insumo.tipo === "MANO_DE_OBRA") lineMO += compCost;
            else if (comp.insumo.tipo === "EQUIPO") lineEQ += compCost;
          }
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
        precioVenta: precioUnit * MARKUP_FACTOR,
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
      rubros: Array.from(rubrosMap.values()).map((g) => {
        // Convertir insumosMap a array ordenado: MO primero, luego MAT, EQ, SUB
        const tipoOrder = ["MANO_DE_OBRA", "MATERIAL", "EQUIPO", "SUBCONTRATO"];
        const insumosRubro = Array.from(g.insumosMap.values())
          .filter((i) => i.cantidad > 0)
          .sort((a, b) => {
            const ta = tipoOrder.indexOf(a.tipo);
            const tb = tipoOrder.indexOf(b.tipo);
            if (ta !== tb) return ta - tb;
            return b.cantidad - a.cantidad;
          });
        return {
          nombre: g.nombre,
          normalizado: g.normalizado,
          totalMat: g.totalMat,
          totalMO: g.totalMO,
          totalEQ: g.totalEQ,
          totalPV: g.totalPV,
          totalRubro: g.totalRubro,
          insumosRubro,
          lineas: g.lineas,
        };
      }),
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

// ─── Resumen liviano de cronograma de TODAS las obras ─────────────────────────
// GET /api/obras/cronograma/resumen
router.get("/cronograma/resumen", async (_req: Request, res: Response) => {
  try {
    const hoy = new Date();
    const obras = await prisma.obra.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, nombre: true, codigo: true, estado: true },
    });

    const resumen = await Promise.all(obras.map(async (obra) => {
      const header = await prisma.presupuestoHeader.findFirst({
        where: { obraId: obra.id, estado: "vigente" },
        orderBy: { createdAt: "desc" },
        select: { id: true, fechaInicio: true },
      });

      if (!header) {
        return { obra, cronogramaCargado: false as const };
      }

      // Cargamos solo lo mínimo necesario para el resumen
      const lineas = await prisma.lineaPresupuesto.findMany({
        where: { obraId: obra.id, presupuestoHeaderId: header.id },
        select: {
          rubro: true,
          cantidad: true,
          precioUnitarioSnapshot: true,
          cronograma: { select: { fecha: true, pctEjecucion: true, mesOrdinal: true } },
        },
      });

      const lineasConCron = lineas.filter((l) => l.cronograma.length > 0);
      if (lineasConCron.length === 0) {
        return { obra, cronogramaCargado: false as const };
      }

      // Recolectar fechas únicas para timeline y mes actual
      const fechasSet = new Set<number>();
      for (const l of lineasConCron) for (const c of l.cronograma) fechasSet.add(c.fecha.getTime());
      const fechasOrdenadas = [...fechasSet].sort((a, b) => a - b);
      const fechaInicio = fechasOrdenadas[0];
      const fechaFin = fechasOrdenadas[fechasOrdenadas.length - 1];

      // Mes actual = el último mes cuyo inicio sea <= hoy (o el primero si hoy es anterior al inicio)
      const mesesPasados = fechasOrdenadas.filter((f) => f <= hoy.getTime());
      const mesActualMs = mesesPasados.length > 0 ? mesesPasados[mesesPasados.length - 1] : fechasOrdenadas[0];

      // Calcular avance acumulado a hoy por rubro
      type RubroEstado = { totalRubro: number; avanceMonto: number };
      const rubrosMap = new Map<string, RubroEstado>();
      let totalGlobal = 0;
      let avanceMontoGlobal = 0;

      for (const l of lineasConCron) {
        const cant = Number(l.cantidad);
        const precio = Number(l.precioUnitarioSnapshot);
        const total = cant * precio;
        let pctAvance = 0;
        for (const c of l.cronograma) {
          if (c.fecha.getTime() <= hoy.getTime()) pctAvance += Number(c.pctEjecucion);
        }
        pctAvance = Math.min(1, pctAvance);

        const rubroKey = l.rubro || "GENERAL";
        const r = rubrosMap.get(rubroKey) ?? { totalRubro: 0, avanceMonto: 0 };
        r.totalRubro += total;
        r.avanceMonto += total * pctAvance;
        rubrosMap.set(rubroKey, r);

        totalGlobal += total;
        avanceMontoGlobal += total * pctAvance;
      }

      let rubrosTerminados = 0, rubrosEnCurso = 0, rubrosNoIniciados = 0;
      for (const r of rubrosMap.values()) {
        const pct = r.totalRubro > 0 ? r.avanceMonto / r.totalRubro : 0;
        if (pct >= 0.999) rubrosTerminados++;
        else if (pct <= 0.001) rubrosNoIniciados++;
        else rubrosEnCurso++;
      }

      return {
        obra,
        cronogramaCargado: true as const,
        fechaInicio: header.fechaInicio ?? new Date(fechaInicio),
        fechaFin: new Date(fechaFin),
        mesActual: new Date(mesActualMs),
        totalMeses: fechasOrdenadas.length,
        pctAcumuladoAhoy: totalGlobal > 0 ? avanceMontoGlobal / totalGlobal : 0,
        totalGlobal,
        avanceMontoGlobal,
        rubrosTotal: rubrosMap.size,
        rubrosTerminados,
        rubrosEnCurso,
        rubrosNoIniciados,
      };
    }));

    res.json(resumen);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al obtener resumen" });
  }
});

// ─── Cronograma de avance esperado ────────────────────────────────────────────
// GET /api/obras/:id/cronograma?mes=YYYY-MM-DD (default: mes en curso a partir de hoy)
// Devuelve:
//   - rubros con avance esperado a la fecha de hoy + estado
//   - tareas activas en el mes seleccionado
//   - insumos consolidados que se necesitan en el mes seleccionado
//   - meses para timeline
router.get("/:id/cronograma", async (req: Request, res: Response) => {
  try {
    const obra = await prisma.obra.findUnique({
      where: { id: req.params.id },
      select: { id: true, nombre: true, codigo: true },
    });
    if (!obra) {
      res.status(404).json({ error: "Obra no encontrada" });
      return;
    }

    const header = await prisma.presupuestoHeader.findFirst({
      where: { obraId: obra.id, estado: "vigente" },
      orderBy: { createdAt: "desc" },
      select: { id: true, fechaInicio: true },
    });

    if (!header) {
      res.status(404).json({ error: "La obra no tiene presupuesto vigente" });
      return;
    }

    // Cargar líneas con cronograma y composiciones (para calcular insumos del mes)
    const lineas = await prisma.lineaPresupuesto.findMany({
      where: { obraId: obra.id, presupuestoHeaderId: header.id },
      include: {
        cronograma: { orderBy: { mesOrdinal: "asc" } },
        partida: {
          include: {
            composiciones: { include: { insumo: true } },
          },
        },
      },
    });

    // Si no hay cronograma cargado en ninguna línea → devolver vacío con flag
    const totalLineasConCron = lineas.filter((l) => l.cronograma.length > 0).length;
    if (totalLineasConCron === 0) {
      res.json({
        obra,
        cronogramaCargado: false,
        rubros: [],
        meses: [],
        insumosDelMes: [],
        kpi: null,
        mesSeleccionado: null,
      });
      return;
    }

    // Construir lista de meses únicos a partir de los cronogramas
    const mesesMap = new Map<number, Date>();
    for (const l of lineas) {
      for (const c of l.cronograma) {
        if (!mesesMap.has(c.mesOrdinal)) mesesMap.set(c.mesOrdinal, c.fecha);
      }
    }
    const mesesOrdenados = [...mesesMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([mesOrdinal, fecha]) => ({
        mesOrdinal,
        fecha,
        etiqueta: `MES ${mesOrdinal}`,
      }));

    // Mes seleccionado: viene por query o se calcula a partir de hoy
    const hoy = new Date();
    const mesQuery = req.query.mes as string | undefined;
    let mesSeleccionado = mesesOrdenados.find((m) => {
      if (mesQuery) return m.fecha.toISOString().slice(0, 7) === mesQuery.slice(0, 7);
      // Default: encontrar el mes cuya fecha esté más cerca de hoy (no posterior)
      return false;
    });

    if (!mesSeleccionado) {
      // Buscar el mes vigente: la última fecha ≤ hoy
      const mesesPasados = mesesOrdenados.filter((m) => m.fecha.getTime() <= hoy.getTime());
      mesSeleccionado = mesesPasados.length > 0
        ? mesesPasados[mesesPasados.length - 1]
        : mesesOrdenados[0];
    }

    // Fecha de referencia para calcular avance acumulado:
    // - Si el usuario seleccionó un mes específico → usa esa fecha (sirve para ver "qué se debería tener hecho
    //   hasta MES X" tanto en pasado como en futuro)
    // - Si no seleccionó nada → usa hoy (vista por defecto = "qué llevamos a esta fecha")
    const fechaRef: Date = mesSeleccionado ? mesSeleccionado.fecha : hoy;

    // Calcular avance esperado de cada rubro a la fecha de referencia
    // Para cada línea: pctAvance = sum(cronograma.pct donde fecha <= fechaRef)
    // rubro.pctAvance = sum(linea.totalCD * pctAvance) / sum(linea.totalCD)
    type RubroAgg = {
      nombre: string;
      totalRubro: number;
      avanceMonto: number;          // suma de (linea.total × pctAvance)
      tareasActivasMes: {
        itemNumero: string | null;
        descripcion: string;
        cantidad: number;
        unidad: string | null;
        pctEjecucionMes: number;
      }[];
    };
    const rubrosMap = new Map<string, RubroAgg>();

    // Insumos consolidados del mes seleccionado
    type InsumoAgg = {
      codigo: string;
      descripcion: string;
      tipo: string;
      unidad: string;
      categoria: string | null;
      fuenteCategoria: string | null;
      cantidad: number;
    };
    const insumosMesMap = new Map<string, InsumoAgg>();

    let totalGlobal = 0;
    let avanceMontoGlobal = 0;

    for (const linea of lineas) {
      const rubroNombre = linea.rubro || "GENERAL";
      const cant = Number(linea.cantidad);
      const precioUnit = Number(linea.precioUnitarioSnapshot);
      const total = cant * precioUnit;

      if (!rubrosMap.has(rubroNombre)) {
        rubrosMap.set(rubroNombre, {
          nombre: rubroNombre,
          totalRubro: 0,
          avanceMonto: 0,
          tareasActivasMes: [],
        });
      }
      const ru = rubrosMap.get(rubroNombre)!;
      ru.totalRubro += total;
      totalGlobal += total;

      // Suma de % ejecutado hasta hoy
      let pctAvance = 0;
      let pctEsteMes = 0;
      for (const c of linea.cronograma) {
        const pct = Number(c.pctEjecucion);
        if (c.fecha.getTime() <= fechaRef.getTime()) pctAvance += pct;
        if (mesSeleccionado && c.fecha.getTime() === mesSeleccionado.fecha.getTime()) {
          pctEsteMes = pct;
        }
      }

      ru.avanceMonto += total * Math.min(1, pctAvance);
      avanceMontoGlobal += total * Math.min(1, pctAvance);

      // Si la tarea tiene ejecución en el mes seleccionado, agregarla
      if (pctEsteMes > 0) {
        ru.tareasActivasMes.push({
          itemNumero: linea.itemNumero,
          descripcion: linea.partida?.descripcion ?? linea.descripcionLibre ?? "",
          cantidad: cant,
          unidad: linea.partida?.unidad ?? null,
          pctEjecucionMes: pctEsteMes,
        });

        // Calcular insumos del mes (composición × cantidad × pct del mes)
        if (linea.partida) {
          const rend = linea.partida.rendimiento ? Number(linea.partida.rendimiento) : null;
          for (const comp of linea.partida.composiciones) {
            const tipoIns = comp.insumo.tipo;
            const cantPorUd = Number(comp.cantidadPorUnidad);
            const desp = Number(comp.pctDesperdicio);
            // Cantidad de insumo para el MES = composición × cantidad de la tarea ejecutada este mes
            const cantDelMes = cant * pctEsteMes;
            let cantInsumo: number;
            if (tipoIns === "MANO_DE_OBRA" || tipoIns === "EQUIPO") {
              cantInsumo = rend && rend > 0
                ? (cantPorUd / rend) * cantDelMes
                : cantPorUd * cantDelMes;
            } else {
              cantInsumo = cantPorUd * (1 + desp) * cantDelMes;
            }

            const key = comp.insumo.codigo;
            const existing = insumosMesMap.get(key);
            if (existing) {
              existing.cantidad += cantInsumo;
            } else {
              insumosMesMap.set(key, {
                codigo: comp.insumo.codigo,
                descripcion: comp.insumo.descripcion,
                tipo: tipoIns,
                unidad: comp.insumo.unidad,
                categoria: comp.insumo.categoria ?? null,
                fuenteCategoria: (comp.insumo as { fuenteCategoria?: string | null }).fuenteCategoria ?? null,
                cantidad: cantInsumo,
              });
            }
          }
        }
      }
    }

    // Serializar rubros con avance y estado
    const rubros = [...rubrosMap.values()].map((r) => {
      const pctEsperadoAhoy = r.totalRubro > 0 ? r.avanceMonto / r.totalRubro : 0;
      let estado: "no_iniciada" | "en_curso" | "terminada";
      if (pctEsperadoAhoy >= 0.999) estado = "terminada";
      else if (pctEsperadoAhoy <= 0.001) estado = "no_iniciada";
      else estado = "en_curso";
      return {
        nombre: r.nombre,
        totalRubro: r.totalRubro,
        pctEsperadoAhoy,
        estado,
        tareasActivasMes: r.tareasActivasMes.sort((a, b) => b.pctEjecucionMes - a.pctEjecucionMes),
      };
    });

    // Ordenar rubros por totalRubro desc para que aparezcan los más importantes primero
    rubros.sort((a, b) => b.totalRubro - a.totalRubro);

    // Insumos del mes ordenados: MO primero, luego MAT, EQ, SUB; dentro de cada uno por cantidad desc
    const tipoOrder = ["MANO_DE_OBRA", "MATERIAL", "EQUIPO", "SUBCONTRATO"];
    const insumosDelMes = [...insumosMesMap.values()]
      .filter((i) => i.cantidad > 0.0001)
      .sort((a, b) => {
        const ta = tipoOrder.indexOf(a.tipo);
        const tb = tipoOrder.indexOf(b.tipo);
        if (ta !== tb) return ta - tb;
        return b.cantidad - a.cantidad;
      });

    res.json({
      obra,
      cronogramaCargado: true,
      kpi: {
        totalGlobal,
        avanceMontoGlobal,
        // % acumulado al mes seleccionado (o a hoy si no hay selección)
        pctAcumulado: totalGlobal > 0 ? avanceMontoGlobal / totalGlobal : 0,
        // True si el mes seleccionado coincide con el mes calendario actual
        esFechaHoy: mesSeleccionado != null
          && mesSeleccionado.fecha.getMonth() === hoy.getMonth()
          && mesSeleccionado.fecha.getFullYear() === hoy.getFullYear(),
        fechaInicio: header.fechaInicio,
        fechaFin: mesesOrdenados[mesesOrdenados.length - 1]?.fecha ?? null,
        fechaHoy: hoy,
        fechaRef,
        rubrosTerminados: rubros.filter((r) => r.estado === "terminada").length,
        rubrosEnCurso: rubros.filter((r) => r.estado === "en_curso").length,
        rubrosNoIniciados: rubros.filter((r) => r.estado === "no_iniciada").length,
      },
      meses: mesesOrdenados,
      mesSeleccionado,
      rubros,
      insumosDelMes,
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Error al obtener cronograma",
    });
  }
});

export default router;

import { Router, Request, Response } from "express";
import prisma from "../prisma/client";
import { precioVentaUnitario } from "../lib/pricing";
import { calcCantInsumo } from "../lib/composicion";
import { getLatestIccRaw, calcCoefICC } from "../lib/icc";
import {
  computarCertificacionMes,
  ensureContratoApp,
  computarValorizacion,
  sugerirValorizacionInputs,
  computarCobranza,
} from "../services/certificacion-avance.service";

const router = Router();

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

const ESTADOS_OBRA = ["EN_PRESUPUESTO", "EN_CURSO", "FINALIZADA"] as const;

// Normaliza el código igual que lo deriva el importador del Resumen (deriveObraCodigo):
// mayúsculas, sin espacios ni símbolos. Así una obra creada a mano matchea el archivo que se
// importe después.
function normalizeCodigo(raw: string): string {
  return raw.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

router.post("/", async (req: Request, res: Response) => {
  try {
    const { nombre, codigo, fechaInicio, estado, centroCosto } = req.body as {
      nombre?: string; codigo?: string; fechaInicio?: string; estado?: string; centroCosto?: string;
    };

    const nombreLimpio = nombre?.trim();
    const codigoLimpio = codigo ? normalizeCodigo(codigo) : "";
    if (!nombreLimpio || !codigoLimpio) {
      res.status(400).json({ error: "nombre y codigo son requeridos" });
      return;
    }
    if (estado && !ESTADOS_OBRA.includes(estado as (typeof ESTADOS_OBRA)[number])) {
      res.status(400).json({ error: `estado inválido (esperado: ${ESTADOS_OBRA.join(", ")})` });
      return;
    }

    const obra = await prisma.obra.create({
      data: {
        nombre: nombreLimpio,
        codigo: codigoLimpio,
        fechaInicio: fechaInicio ? new Date(fechaInicio) : null,
        estado: (estado as (typeof ESTADOS_OBRA)[number]) ?? "EN_PRESUPUESTO",
        centroCosto: centroCosto?.trim() || null,
      },
    });
    res.status(201).json(obra);
  } catch (err) {
    // Código duplicado (@unique) → 409 para que el front muestre un mensaje claro
    if (err && typeof err === "object" && (err as { code?: string }).code === "P2002") {
      res.status(409).json({ error: "Ya existe una obra con ese código" });
      return;
    }
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
          select: { precioUnitarioSnapshot: true, cantidad: true, rubro: true, precioVenta: true },
        });

        let totalGeneral = 0;
        let totalPV = 0;
        const rubrosSet = new Set<string>();
        for (const l of lineas) {
          const cant = Number(l.cantidad);
          totalGeneral += Number(l.precioUnitarioSnapshot) * cant;
          totalPV += precioVentaUnitario(l.precioVenta, l.precioUnitarioSnapshot, header.coefGGBB) * cant;
          if (l.rubro) rubrosSet.add(l.rubro);
        }

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
      const pvUnit = precioVentaUnitario(linea.precioVenta, precioUnit, header?.coefGGBB);
      const pv = pvUnit * cant;

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
        precioVenta: pvUnit,
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

    const cacValorNum = header ? Number(header.cacValor) : null;
    const latestIcc = await getLatestIccRaw();
    const coefICC = cacValorNum ? calcCoefICC(cacValorNum, latestIcc?.valorAbsoluto ?? null) : null;

    res.json({
      obra: { id: obra.id, nombre: obra.nombre, codigo: obra.codigo },
      presupuesto: header ? {
        id: header.id,
        nombre: header.nombre ?? null,
        version: header.version ?? null,
        mesCac: header.mesCac,
        coefGGBB: header.coefGGBB ? Number(header.coefGGBB) : null,
      } : null,
      cacValor: cacValorNum,
      mesCac: header?.mesCac ?? null,
      icc: {
        base: cacValorNum,
        actual: latestIcc?.valorAbsoluto ?? null,
        coef: coefICC,
        mesBase: header?.mesCac ?? null,
        mesActual: latestIcc?.mesLabel ?? null,
        variacionMensual: latestIcc?.variacionMensual ?? null,
      },
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
    // Monto planificado por mes (suma de total × pct) → serie mensual / curva S real
    const montoPorMes = new Map<number, number>();

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
        montoPorMes.set(c.mesOrdinal, (montoPorMes.get(c.mesOrdinal) ?? 0) + total * pct);
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

    // Serie mensual real (curva S): % del mes y % acumulado, derivados del cronograma
    let acumSerie = 0;
    const serieMensual = mesesOrdenados.map((m) => {
      const monto = montoPorMes.get(m.mesOrdinal) ?? 0;
      acumSerie += monto;
      return {
        mesOrdinal: m.mesOrdinal,
        fecha: m.fecha,
        pctMes: totalGlobal > 0 ? monto / totalGlobal : 0,
        pctAcumulado: totalGlobal > 0 ? acumSerie / totalGlobal : 0,
      };
    });

    res.json({
      obra,
      cronogramaCargado: true,
      serieMensual,
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

// ─── Cronograma editable ──────────────────────────────────────────────────────
// Header preferido para el cronograma: APROBADO (trae venta + cronograma); si no, el vigente.
async function getCronogramaHeaderId(obraId: string): Promise<string | null> {
  const apr = await prisma.presupuestoHeader.findFirst({
    where: { obraId, estado: "vigente", tipo: "APROBADO" }, orderBy: { createdAt: "desc" }, select: { id: true },
  });
  if (apr) return apr.id;
  const vig = await prisma.presupuestoHeader.findFirst({
    where: { obraId, estado: "vigente" }, orderBy: { createdAt: "desc" }, select: { id: true },
  });
  return vig?.id ?? null;
}

// GET /api/obras/:id/cronograma/matriz — matriz editable (tarea × mes, % de ejecución)
router.get("/:id/cronograma/matriz", async (req: Request, res: Response) => {
  try {
    const obra = await prisma.obra.findUnique({ where: { id: req.params.id }, select: { id: true, nombre: true, codigo: true } });
    if (!obra) { res.status(404).json({ error: "Obra no encontrada" }); return; }
    const headerId = await getCronogramaHeaderId(obra.id);
    if (!headerId) { res.json({ obra, headerId: null, meses: [], filas: [] }); return; }

    const lineas = await prisma.lineaPresupuesto.findMany({
      where: { presupuestoHeaderId: headerId },
      include: { partida: { select: { descripcion: true } }, cronograma: { select: { fecha: true, pctEjecucion: true } } },
      orderBy: { orden: "asc" },
    });

    const mesSet = new Map<string, Date>();
    for (const l of lineas) for (const c of l.cronograma) {
      const ym = c.fecha.toISOString().slice(0, 7);
      if (!mesSet.has(ym)) mesSet.set(ym, c.fecha);
    }
    const meses = [...mesSet.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([ym, fecha]) => ({ ym, fecha: fecha.toISOString() }));

    const filas = lineas.map((l) => {
      const pctPorMes: Record<string, number> = {};
      for (const c of l.cronograma) {
        const ym = c.fecha.toISOString().slice(0, 7);
        pctPorMes[ym] = (pctPorMes[ym] ?? 0) + Number(c.pctEjecucion);
      }
      return {
        lineaId: l.id,
        itemNumero: l.itemNumero,
        rubro: l.rubro || "GENERAL",
        descripcion: l.partida?.descripcion ?? l.descripcionLibre ?? "",
        cantidad: Number(l.cantidad),
        pctPorMes,
      };
    });

    res.json({ obra, headerId, meses, filas });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al obtener matriz de cronograma" });
  }
});

// PUT /api/obras/:id/cronograma — reemplaza el cronograma (LineaCronograma) del header vigente.
// body: { filas: [{ lineaId, pctPorMes: { "YYYY-MM": fracción } }] }
router.put("/:id/cronograma", async (req: Request, res: Response) => {
  try {
    const obra = await prisma.obra.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!obra) { res.status(404).json({ error: "Obra no encontrada" }); return; }
    const headerId = await getCronogramaHeaderId(obra.id);
    if (!headerId) { res.status(404).json({ error: "La obra no tiene presupuesto vigente" }); return; }

    const filas = (req.body?.filas ?? []) as { lineaId: string; pctPorMes: Record<string, number> }[];
    if (!Array.isArray(filas)) { res.status(400).json({ error: "filas debe ser un array" }); return; }

    // Solo líneas del header vigente
    const lineasHeader = await prisma.lineaPresupuesto.findMany({ where: { presupuestoHeaderId: headerId }, select: { id: true } });
    const validIds = new Set(lineasHeader.map((l) => l.id));

    // Meses (union) → ordinal estable
    const mesSet = new Set<string>();
    for (const f of filas) for (const [ym, p] of Object.entries(f.pctPorMes ?? {})) {
      if (/^\d{4}-\d{2}$/.test(ym) && Number(p) > 0) mesSet.add(ym);
    }
    const meses = [...mesSet].sort();
    const ordinalByYm = new Map(meses.map((ym, i) => [ym, i]));

    const cronoData: { lineaId: string; mesOrdinal: number; fecha: Date; pctEjecucion: number }[] = [];
    for (const f of filas) {
      if (!validIds.has(f.lineaId)) continue;
      for (const [ym, p] of Object.entries(f.pctPorMes ?? {})) {
        const frac = Number(p);
        if (!(frac > 0) || !ordinalByYm.has(ym)) continue;
        cronoData.push({ lineaId: f.lineaId, mesOrdinal: ordinalByYm.get(ym)!, fecha: new Date(`${ym}-01T00:00:00Z`), pctEjecucion: frac });
      }
    }

    await prisma.$transaction([
      prisma.lineaCronograma.deleteMany({ where: { lineaId: { in: [...validIds] } } }),
      prisma.lineaCronograma.createMany({ data: cronoData, skipDuplicates: true }),
    ]);

    res.json({ ok: true, filas: filas.length, cronogramaFilas: cronoData.length, meses: meses.length });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al guardar cronograma" });
  }
});

// ─── Avance REAL de ejecución ────────────────────────────────────────────────
// Selecciona el presupuesto vigente de la obra y lista rubros → tareas con su % acumulado real
// (suma de incrementos reportados). El avance del rubro y global se pondera por costo directo.
// GET /api/obras/:id/avance
router.get("/:id/avance", async (req: Request, res: Response) => {
  try {
    const obra = await prisma.obra.findUnique({ where: { id: req.params.id } });
    if (!obra) return res.status(404).json({ error: "Obra no encontrada" });

    const header = await prisma.presupuestoHeader.findFirst({
      where: { obraId: obra.id, estado: "vigente" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!header) {
      return res.json({ obra: { id: obra.id, nombre: obra.nombre, codigo: obra.codigo }, rubros: [], avanceGlobal: { pctReal: 0 } });
    }

    const lineas = await prisma.lineaPresupuesto.findMany({
      where: { obraId: obra.id, presupuestoHeaderId: header.id },
      include: {
        partida: { select: { descripcion: true, unidad: true } },
        avances: { select: { pctIncremento: true, cantidad: true, fecha: true }, orderBy: { fecha: "desc" } },
      },
      orderBy: [{ orden: "asc" }, { rubro: "asc" }],
    });

    type Tarea = {
      lineaId: string; itemNumero: string | null; descripcion: string; unidad: string;
      cantidad: number; costoDirecto: number;
      pctAcumulado: number; cantidadEjecutada: number; ultimoReporte: string | null;
    };
    const rubrosMap = new Map<string, { nombre: string; tareas: Tarea[]; costo: number; costoPonderado: number }>();

    for (const l of lineas) {
      const cantidad = Number(l.cantidad);
      const cdUd = Number(l.precioUnitarioSnapshot);
      const costoDirecto = cantidad * cdUd;
      const sum = l.avances.reduce((s, a) => s + Number(a.pctIncremento), 0);
      const pctAcumulado = Math.min(1, Math.max(0, sum));
      const cantidadEjecutada = cantidad * pctAcumulado;
      const ultimoReporte = l.avances[0]?.fecha ? l.avances[0].fecha.toISOString() : null;

      const tarea: Tarea = {
        lineaId: l.id, itemNumero: l.itemNumero,
        descripcion: l.descripcionLibre ?? l.partida?.descripcion ?? "—",
        unidad: l.partida?.unidad ?? "u",
        cantidad, costoDirecto, pctAcumulado, cantidadEjecutada, ultimoReporte,
      };

      const rubro = l.rubro || "GENERAL";
      if (!rubrosMap.has(rubro)) rubrosMap.set(rubro, { nombre: rubro, tareas: [], costo: 0, costoPonderado: 0 });
      const g = rubrosMap.get(rubro)!;
      g.tareas.push(tarea);
      g.costo += costoDirecto;
      g.costoPonderado += costoDirecto * pctAcumulado;
    }

    let costoTotal = 0, costoPonderadoTotal = 0;
    const rubros = [...rubrosMap.values()].map((g) => {
      costoTotal += g.costo;
      costoPonderadoTotal += g.costoPonderado;
      const pct = g.costo > 0
        ? g.costoPonderado / g.costo
        : (g.tareas.length ? g.tareas.reduce((s, t) => s + t.pctAcumulado, 0) / g.tareas.length : 0);
      return { nombre: g.nombre, pctAcumulado: pct, tareas: g.tareas };
    });

    const pctReal = costoTotal > 0 ? costoPonderadoTotal / costoTotal : 0;

    res.json({
      obra: { id: obra.id, nombre: obra.nombre, codigo: obra.codigo },
      rubros,
      avanceGlobal: { pctReal, costoDirecto: costoTotal, montoEjecutado: costoPonderadoTotal },
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al obtener avance" });
  }
});

// POST /api/obras/:id/avance — reportar un incremento de avance de una tarea.
// Body: { lineaId, pctIncremento?: número 0..100 (%), cantidad?: número (de la tarea), nota? }
// Se pasa % directo O una cantidad ejecutada (que el server convierte a % sobre la cantidad de la tarea).
router.post("/:id/avance", async (req: Request, res: Response) => {
  try {
    const { lineaId, pctIncremento, cantidad, nota } = req.body as {
      lineaId?: string; pctIncremento?: number; cantidad?: number; nota?: string;
    };
    if (!lineaId) return res.status(400).json({ error: "lineaId es requerido" });

    const linea = await prisma.lineaPresupuesto.findFirst({
      where: { id: lineaId, obraId: req.params.id },
      include: { avances: { select: { pctIncremento: true } } },
    });
    if (!linea) return res.status(404).json({ error: "Tarea no encontrada en esta obra" });

    const cantTarea = Number(linea.cantidad);
    let frac: number;        // incremento como fracción 0..1
    let cantReportada: number | null = null;

    if (cantidad != null && !isNaN(cantidad)) {
      if (cantTarea <= 0) return res.status(400).json({ error: "La tarea no tiene cantidad — reportá por porcentaje" });
      cantReportada = cantidad;
      frac = cantidad / cantTarea;
    } else if (pctIncremento != null && !isNaN(pctIncremento)) {
      frac = pctIncremento / 100;
    } else {
      return res.status(400).json({ error: "Indicá pctIncremento (%) o cantidad" });
    }
    if (frac <= 0) return res.status(400).json({ error: "El avance debe ser mayor a 0" });

    const acumPrevio = Math.min(1, linea.avances.reduce((s, a) => s + Number(a.pctIncremento), 0));

    await prisma.avanceReporte.create({
      data: { lineaId, pctIncremento: frac, cantidad: cantReportada, nota: nota || null },
    });

    const acumNuevo = Math.min(1, acumPrevio + frac);
    res.json({
      ok: true,
      lineaId,
      pctAnterior: acumPrevio,
      pctIncremento: frac,
      pctAcumulado: acumNuevo,
      cantidadEjecutada: cantTarea * acumNuevo,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al reportar avance" });
  }
});

// GET /api/obras/:id/avance/diario?mes=&anio= — reportes de avance agrupados por día (calendario).
// Cada AvanceReporte es lo que el jefe de obra cargó ese día para una tarea (pctIncremento).
// Se agrupa por fecha en hora Argentina (UTC-3) para que el día del calendario sea el local.
router.get("/:id/avance/diario", async (req: Request, res: Response) => {
  try {
    const obra = await prisma.obra.findUnique({
      where: { id: req.params.id },
      select: { id: true, nombre: true, codigo: true },
    });
    if (!obra) return res.status(404).json({ error: "Obra no encontrada" });

    const mes = Number(req.query.mes);
    const anio = Number(req.query.anio);
    if (!Number.isInteger(mes) || mes < 1 || mes > 12 || !Number.isInteger(anio)) {
      return res.status(400).json({ error: "mes (1-12) y anio son requeridos" });
    }

    const OFF = -3 * 3600 * 1000; // ART = UTC-3
    const artDate = (d: Date) => new Date(d.getTime() + OFF).toISOString().slice(0, 10);
    // Límites del mes en ART, expresados como instantes UTC.
    const inicio = new Date(Date.UTC(anio, mes - 1, 1) - OFF);
    const fin = new Date(Date.UTC(mes === 12 ? anio + 1 : anio, mes === 12 ? 0 : mes, 1) - OFF);

    const reportes = await prisma.avanceReporte.findMany({
      where: { fecha: { gte: inicio, lt: fin }, linea: { obraId: obra.id } },
      orderBy: { fecha: "asc" },
      select: {
        id: true, fecha: true, pctIncremento: true, cantidad: true, nota: true,
        linea: {
          select: {
            id: true, itemNumero: true, rubro: true, descripcionLibre: true,
            partida: { select: { descripcion: true, unidad: true } },
          },
        },
      },
    });

    const diasMap = new Map<string, Array<Record<string, unknown>>>();
    for (const r of reportes) {
      const dia = artDate(r.fecha);
      const arr = diasMap.get(dia) ?? [];
      arr.push({
        id: r.id,
        lineaId: r.linea.id,
        itemNumero: r.linea.itemNumero,
        descripcion: r.linea.descripcionLibre ?? r.linea.partida?.descripcion ?? "—",
        rubro: r.linea.rubro || "GENERAL",
        unidad: r.linea.partida?.unidad ?? "u",
        pctIncremento: Number(r.pctIncremento), // fracción 0..1 cargada ese día
        cantidad: r.cantidad != null ? Number(r.cantidad) : null,
        nota: r.nota,
        hora: r.fecha.toISOString(),
      });
      diasMap.set(dia, arr);
    }

    const dias = [...diasMap.entries()]
      .map(([fecha, tareas]) => ({ fecha, reportes: tareas.length, tareas }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    res.json({ obra, mes, anio, dias });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al obtener avance diario" });
  }
});

// ─── Certificaciones de avance (armadas desde la web) ───────────────────────────
// Valorizadas a precio de venta. Reutilizan Certificacion/CertificacionLinea con fuente='app'
// colgando de un ContratoCliente sintético (ocId='APP') que el import NO borra.

const fmtCertId = (mes: number, anio: number) => `AV-${anio}-${String(mes).padStart(2, "0")}`;

// Campos que se devuelven al frontend para una certificación (cabecera).
const CERT_SELECT = {
  id: true, certId: true, fecha: true, baseBruta: true, desacopio: true,
  subtotalNeto: true, pctDesacopio: true, estado: true,
  periodoMes: true, periodoAnio: true, nota: true,
  pctFacturable: true, pctIva: true, indiceCacBase: true, indiceCacFecha: true,
} as const;

// Ciclo de vida de la certificación de avance:
//   borrador → enviada (al cliente) → conformada (cliente valida) → valorizada (formal: CAC/IVA/desdoblamiento)
//   → facturada → cobrada. Se permite revertir un paso.
const CERT_ESTADOS = ["borrador", "enviada", "conformada", "valorizada", "facturada", "cobrada"];
const CERT_TRANSICIONES: Record<string, string[]> = {
  borrador: ["enviada"],
  enviada: ["conformada", "borrador"],
  conformada: ["valorizada", "enviada"],
  valorizada: ["facturada", "conformada"],
  facturada: ["cobrada", "valorizada"],
  cobrada: ["facturada"],
};

function serializeCert(c: {
  id: string; certId: string; fecha: Date; baseBruta: unknown; desacopio: unknown;
  subtotalNeto: unknown; pctDesacopio: unknown; estado: string;
  periodoMes: number | null; periodoAnio: number | null; nota: string | null;
  pctFacturable: unknown; pctIva: unknown; indiceCacBase: unknown; indiceCacFecha: unknown;
}) {
  const subtotal = Number(c.subtotalNeto);
  // Si la cert ya está valorizada (tiene inputs), incluir el desglose computado.
  const valorizacion =
    c.pctFacturable != null
      ? computarValorizacion({
          subtotal,
          pctFacturable: Number(c.pctFacturable),
          pctIva: Number(c.pctIva ?? 0),
          indiceCacBase: Number(c.indiceCacBase ?? 0),
          indiceCacFecha: Number(c.indiceCacFecha ?? 0),
        })
      : null;
  return {
    id: c.id,
    certId: c.certId,
    fecha: c.fecha.toISOString(),
    mes: c.periodoMes,
    anio: c.periodoAnio,
    bruto: Number(c.baseBruta),          // base bruta = Σ avance × PV
    pctDesacopio: Number(c.pctDesacopio), // fracción 0..1
    desacopio: Number(c.desacopio),       // monto descontado
    subtotal,                             // bruto − desacopio = lo que se envía al cliente
    estado: c.estado,
    nota: c.nota,
    // Inputs persistidos de la valorización (null si aún no se valorizó)
    pctFacturable: c.pctFacturable != null ? Number(c.pctFacturable) : null,
    pctIva: c.pctIva != null ? Number(c.pctIva) : null,
    indiceCacBase: c.indiceCacBase != null ? Number(c.indiceCacBase) : null,
    indiceCacFecha: c.indiceCacFecha != null ? Number(c.indiceCacFecha) : null,
    valorizacion,
  };
}

// GET /api/obras/:id/certificaciones — lista de certificaciones de avance (fuente='app')
router.get("/:id/certificaciones", async (req: Request, res: Response) => {
  try {
    const certs = await prisma.certificacion.findMany({
      where: { fuente: "app", contrato: { obraId: req.params.id } },
      orderBy: [{ periodoAnio: "desc" }, { periodoMes: "desc" }],
      select: CERT_SELECT,
    });
    res.json({ certificaciones: certs.map(serializeCert) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al listar certificaciones" });
  }
});

// GET /api/obras/:id/certificaciones/preview?mes=&anio= — calcula (sin persistir) la cert del mes
router.get("/:id/certificaciones/preview", async (req: Request, res: Response) => {
  try {
    const mes = Number(req.query.mes);
    const anio = Number(req.query.anio);
    if (!Number.isInteger(mes) || mes < 1 || mes > 12 || !Number.isInteger(anio)) {
      return res.status(400).json({ error: "mes (1-12) y anio son requeridos" });
    }
    const data = await computarCertificacionMes(req.params.id, mes, anio);
    if (!data) return res.status(404).json({ error: "Obra no encontrada" });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al calcular certificación" });
  }
});

// GET /api/obras/:id/certificaciones/:certId — detalle con líneas
router.get("/:id/certificaciones/:certId", async (req: Request, res: Response) => {
  try {
    const cert = await prisma.certificacion.findFirst({
      where: { id: req.params.certId, fuente: "app", contrato: { obraId: req.params.id } },
      include: {
        lineas: {
          include: { linea: { select: { rubro: true, partida: { select: { unidad: true } } } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!cert) return res.status(404).json({ error: "Certificación no encontrada" });
    res.json({
      ...serializeCert(cert),
      lineas: cert.lineas.map((l) => ({
        lineaId: l.lineaId,
        codTarea: l.codTarea,
        descripcion: l.descripcion ?? "—",
        rubro: l.linea?.rubro ?? "GENERAL",
        unidad: l.linea?.partida?.unidad ?? "u",
        pctAnterior: Number(l.pctAnterior),
        pctActual: Number(l.pctActual),
        pctTotal: Number(l.pctTotal),
        pvTotalTarea: Number(l.pvTotalTarea),
        baseCertificada: Number(l.baseCertificada),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al obtener certificación" });
  }
});

// POST /api/obras/:id/certificaciones — emite (persiste) la certificación del mes.
// Body: { mes, anio, nota?, lineas: [{ lineaId, pctActual (0..1) }] }
// Los pctActual pueden venir editados por el usuario. Idempotente por (obra, mes/año): reemplaza.
router.post("/:id/certificaciones", async (req: Request, res: Response) => {
  try {
    const obraId = req.params.id;
    const { mes, anio, nota, pctDesacopio, lineas: lineasEdit } = req.body as {
      mes?: number; anio?: number; nota?: string; pctDesacopio?: number;
      lineas?: Array<{ lineaId: string; pctActual: number }>;
    };
    if (!Number.isInteger(mes) || (mes as number) < 1 || (mes as number) > 12 || !Number.isInteger(anio)) {
      return res.status(400).json({ error: "mes (1-12) y anio son requeridos" });
    }

    // Base calculada desde el avance — fuente de pvTotalTarea, pctAnterior y descripción.
    const calc = await computarCertificacionMes(obraId, mes as number, anio as number);
    if (!calc) return res.status(404).json({ error: "Obra no encontrada" });

    // Override de pctActual por línea (si el usuario los editó).
    const overrides = new Map<string, number>();
    for (const e of lineasEdit ?? []) {
      if (e && e.lineaId && typeof e.pctActual === "number") {
        overrides.set(e.lineaId, Math.min(1, Math.max(0, e.pctActual)));
      }
    }

    const lineasData = calc.lineas
      .map((l) => {
        const pctActual = overrides.has(l.lineaId) ? overrides.get(l.lineaId)! : l.pctActual;
        const pctTotal = Math.min(1, l.pctAnterior + pctActual);
        const baseCertificada = l.pvTotalTarea * pctActual;
        return {
          codTarea: l.itemNumero ?? l.lineaId,
          lineaId: l.lineaId,
          descripcion: l.descripcion,
          pctAnterior: l.pctAnterior.toFixed(6),
          pctActual: pctActual.toFixed(6),
          pctTotal: pctTotal.toFixed(6),
          pvTotalTarea: l.pvTotalTarea.toFixed(2),
          baseCertificada: baseCertificada.toFixed(2),
        };
      })
      .filter((l) => Number(l.pctActual) > 0);

    if (lineasData.length === 0) {
      return res.status(400).json({ error: "No hay avance para certificar en este período" });
    }

    const baseBruta = lineasData.reduce((s, l) => s + Number(l.baseCertificada), 0);
    // Desacopio de la preliminar (lo que se envía al cliente): bruto − desacopio = subtotal.
    // Default al % sugerido del contrato; editable por quien arma la certificación.
    const pctDesacFrac = Math.min(
      1,
      Math.max(0, typeof pctDesacopio === "number" ? pctDesacopio : calc.pctDesacopioSugerido),
    );
    const desacopio = baseBruta * pctDesacFrac;
    const subtotalNeto = baseBruta - desacopio;
    const contratoId = await ensureContratoApp(obraId);
    const certId = fmtCertId(mes as number, anio as number);
    const fecha = new Date(Date.UTC(anio as number, (mes as number), 0)); // último día del mes

    const cert = await prisma.$transaction(async (tx) => {
      // Idempotencia: si ya existe la cert de este mes, la reemplazamos (cascada borra líneas).
      await tx.certificacion.deleteMany({ where: { contratoId, certId } });
      return tx.certificacion.create({
        data: {
          contratoId,
          certId,
          fecha,
          baseBruta: baseBruta.toFixed(2),
          pctDesacopio: pctDesacFrac.toFixed(2),
          desacopio: desacopio.toFixed(2),
          subtotalNeto: subtotalNeto.toFixed(2),
          estado: "borrador",
          fuente: "app",
          periodoMes: mes as number,
          periodoAnio: anio as number,
          nota: nota || null,
          lineas: { create: lineasData },
        },
        select: CERT_SELECT,
      });
    });

    res.status(201).json(serializeCert(cert));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al emitir certificación" });
  }
});

// PATCH /api/obras/:id/certificaciones/:certId — avanzar/retroceder el estado del ciclo de vida
router.patch("/:id/certificaciones/:certId", async (req: Request, res: Response) => {
  try {
    const { estado } = req.body as { estado?: string };
    if (!estado || !CERT_ESTADOS.includes(estado)) {
      return res.status(400).json({ error: `estado inválido (válidos: ${CERT_ESTADOS.join(", ")})` });
    }
    const existing = await prisma.certificacion.findFirst({
      where: { id: req.params.certId, fuente: "app", contrato: { obraId: req.params.id } },
      select: { id: true, estado: true },
    });
    if (!existing) return res.status(404).json({ error: "Certificación no encontrada" });

    const permitidas = CERT_TRANSICIONES[existing.estado] ?? [];
    if (estado !== existing.estado && !permitidas.includes(estado)) {
      return res.status(409).json({
        error: `No se puede pasar de "${existing.estado}" a "${estado}". Transiciones válidas: ${permitidas.join(", ") || "ninguna"}`,
      });
    }

    const cert = await prisma.certificacion.update({
      where: { id: existing.id },
      data: { estado },
      select: CERT_SELECT,
    });
    res.json(serializeCert(cert));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al actualizar certificación" });
  }
});

// GET /api/obras/:id/certificaciones/:certId/valorizacion — inputs sugeridos/persistidos + desglose
// Alimenta la pantalla de valorización. No persiste.
router.get("/:id/certificaciones/:certId/valorizacion", async (req: Request, res: Response) => {
  try {
    const cert = await prisma.certificacion.findFirst({
      where: { id: req.params.certId, fuente: "app", contrato: { obraId: req.params.id } },
      select: {
        subtotalNeto: true, periodoMes: true, periodoAnio: true, estado: true,
        pctFacturable: true, pctIva: true, indiceCacBase: true, indiceCacFecha: true,
      },
    });
    if (!cert) return res.status(404).json({ error: "Certificación no encontrada" });

    // Si ya se valorizó, usar los inputs persistidos; sino, sugerir defaults.
    const sugeridos = await sugerirValorizacionInputs(
      req.params.id, cert.periodoMes ?? 0, cert.periodoAnio ?? 0,
    );
    const inputs = {
      pctFacturable: cert.pctFacturable != null ? Number(cert.pctFacturable) : sugeridos.pctFacturable,
      pctIva: cert.pctIva != null ? Number(cert.pctIva) : sugeridos.pctIva,
      indiceCacBase: cert.indiceCacBase != null ? Number(cert.indiceCacBase) : (sugeridos.indiceCacBase ?? 0),
      indiceCacFecha: cert.indiceCacFecha != null ? Number(cert.indiceCacFecha) : (sugeridos.indiceCacFecha ?? 0),
    };
    const subtotal = Number(cert.subtotalNeto);
    res.json({
      estado: cert.estado,
      subtotal,
      yaValorizada: cert.pctFacturable != null,
      indiceCacFechaDisponible: sugeridos.indiceCacFecha != null,
      inputs,
      valorizacion: computarValorizacion({ subtotal, ...inputs }),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al calcular valorización" });
  }
});

// POST /api/obras/:id/certificaciones/:certId/valorizar — persiste la valorización formal
// Body: { pctFacturable, pctIva, indiceCacBase, indiceCacFecha } (fracciones 0..1 para los %).
// Requiere estado 'conformada' (o 're-valorizar' una ya 'valorizada'). Pasa a estado 'valorizada'.
router.post("/:id/certificaciones/:certId/valorizar", async (req: Request, res: Response) => {
  try {
    const { pctFacturable, pctIva, indiceCacBase, indiceCacFecha } = req.body as {
      pctFacturable?: number; pctIva?: number; indiceCacBase?: number; indiceCacFecha?: number;
    };
    const existing = await prisma.certificacion.findFirst({
      where: { id: req.params.certId, fuente: "app", contrato: { obraId: req.params.id } },
      select: { id: true, estado: true },
    });
    if (!existing) return res.status(404).json({ error: "Certificación no encontrada" });
    if (existing.estado !== "conformada" && existing.estado !== "valorizada") {
      return res.status(409).json({
        error: `La certificación debe estar conformada para valorizarla (estado actual: "${existing.estado}")`,
      });
    }
    const clamp01 = (n: unknown) => Math.min(1, Math.max(0, Number(n) || 0));
    const cert = await prisma.certificacion.update({
      where: { id: existing.id },
      data: {
        estado: "valorizada",
        pctFacturable: clamp01(pctFacturable).toFixed(4),
        pctIva: clamp01(pctIva).toFixed(4),
        indiceCacBase: (Number(indiceCacBase) || 0).toFixed(4),
        indiceCacFecha: (Number(indiceCacFecha) || 0).toFixed(4),
      },
      select: CERT_SELECT,
    });
    res.json(serializeCert(cert));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al valorizar certificación" });
  }
});

// DELETE /api/obras/:id/certificaciones/:certId — borra una certificación (y sus líneas, por cascada)
router.delete("/:id/certificaciones/:certId", async (req: Request, res: Response) => {
  try {
    const existing = await prisma.certificacion.findFirst({
      where: { id: req.params.certId, fuente: "app", contrato: { obraId: req.params.id } },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "Certificación no encontrada" });
    await prisma.certificacion.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al borrar certificación" });
  }
});

// ─── Facturación y cobranza de una certificación ────────────────────────────────

const COMP_TIPOS = ["factura", "recibo", "anticipo"];

function valDeCert(c: {
  subtotalNeto: unknown; pctFacturable: unknown; pctIva: unknown;
  indiceCacBase: unknown; indiceCacFecha: unknown;
}) {
  if (c.pctFacturable == null) return null;
  return computarValorizacion({
    subtotal: Number(c.subtotalNeto),
    pctFacturable: Number(c.pctFacturable),
    pctIva: Number(c.pctIva ?? 0),
    indiceCacBase: Number(c.indiceCacBase ?? 0),
    indiceCacFecha: Number(c.indiceCacFecha ?? 0),
  });
}

function serializeComp(c: {
  id: string; tipo: string; numero: string | null; monto: unknown; fecha: Date;
  fechaCobro: Date | null; retencion: unknown; nota: string | null;
}) {
  return {
    id: c.id, tipo: c.tipo, numero: c.numero,
    monto: Number(c.monto),
    fecha: c.fecha.toISOString(),
    fechaCobro: c.fechaCobro ? c.fechaCobro.toISOString() : null,
    retencion: c.retencion != null ? Number(c.retencion) : null,
    nota: c.nota,
  };
}

// Recalcula el estado de la cert según sus comprobantes (no baja de 'valorizada').
async function recomputeEstadoCobranza(certId: string): Promise<void> {
  const cert = await prisma.certificacion.findUnique({
    where: { id: certId },
    select: {
      estado: true, subtotalNeto: true, pctFacturable: true, pctIva: true,
      indiceCacBase: true, indiceCacFecha: true,
      comprobantes: { select: { tipo: true, monto: true, fechaCobro: true } },
    },
  });
  if (!cert) return;
  // Solo gestionamos automáticamente la cola del ciclo (valorizada→facturada→cobrada).
  if (!["valorizada", "facturada", "cobrada"].includes(cert.estado)) return;
  const cob = computarCobranza(
    valDeCert(cert),
    cert.comprobantes.map((c) => ({ tipo: c.tipo, monto: Number(c.monto), fechaCobro: c.fechaCobro })),
  );
  const nuevo = cob.estadoSugerido ?? "valorizada";
  if (nuevo !== cert.estado) {
    await prisma.certificacion.update({ where: { id: certId }, data: { estado: nuevo } });
  }
}

async function findCertApp(obraId: string, certId: string) {
  return prisma.certificacion.findFirst({
    where: { id: certId, fuente: "app", contrato: { obraId } },
    select: {
      id: true, estado: true, subtotalNeto: true, pctFacturable: true, pctIva: true,
      indiceCacBase: true, indiceCacFecha: true,
      comprobantes: { orderBy: { fecha: "asc" }, select: {
        id: true, tipo: true, numero: true, monto: true, fecha: true,
        fechaCobro: true, retencion: true, nota: true,
      } },
    },
  });
}

// GET .../comprobantes — lista de comprobantes + resumen de facturación/cobranza
router.get("/:id/certificaciones/:certId/comprobantes", async (req: Request, res: Response) => {
  try {
    const cert = await findCertApp(req.params.id, req.params.certId);
    if (!cert) return res.status(404).json({ error: "Certificación no encontrada" });
    const resumen = computarCobranza(
      valDeCert(cert),
      cert.comprobantes.map((c) => ({ tipo: c.tipo, monto: Number(c.monto), fechaCobro: c.fechaCobro })),
    );
    res.json({ estado: cert.estado, resumen, comprobantes: cert.comprobantes.map(serializeComp) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al listar comprobantes" });
  }
});

// POST .../comprobantes — registra una factura/recibo/anticipo
router.post("/:id/certificaciones/:certId/comprobantes", async (req: Request, res: Response) => {
  try {
    const { tipo, numero, monto, fecha, fechaCobro, retencion, nota } = req.body as {
      tipo?: string; numero?: string; monto?: number; fecha?: string;
      fechaCobro?: string | null; retencion?: number; nota?: string;
    };
    if (!tipo || !COMP_TIPOS.includes(tipo)) {
      return res.status(400).json({ error: `tipo inválido (válidos: ${COMP_TIPOS.join(", ")})` });
    }
    if (monto == null || isNaN(Number(monto)) || Number(monto) <= 0) {
      return res.status(400).json({ error: "monto debe ser mayor a 0" });
    }
    const cert = await prisma.certificacion.findFirst({
      where: { id: req.params.certId, fuente: "app", contrato: { obraId: req.params.id } },
      select: { id: true, estado: true },
    });
    if (!cert) return res.status(404).json({ error: "Certificación no encontrada" });
    if (!["valorizada", "facturada", "cobrada"].includes(cert.estado)) {
      return res.status(409).json({ error: `La certificación debe estar valorizada para facturar (estado: "${cert.estado}")` });
    }
    const comp = await prisma.comprobanteCert.create({
      data: {
        certificacionId: cert.id,
        tipo,
        numero: numero || null,
        monto: Number(monto).toFixed(2),
        fecha: fecha ? new Date(fecha) : new Date(),
        fechaCobro: fechaCobro ? new Date(fechaCobro) : null,
        retencion: retencion != null ? Number(retencion).toFixed(2) : null,
        nota: nota || null,
      },
    });
    await recomputeEstadoCobranza(cert.id);
    res.status(201).json(serializeComp(comp));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al registrar comprobante" });
  }
});

// PATCH .../comprobantes/:compId — editar / registrar cobro (fechaCobro)
router.patch("/:id/certificaciones/:certId/comprobantes/:compId", async (req: Request, res: Response) => {
  try {
    const cert = await prisma.certificacion.findFirst({
      where: { id: req.params.certId, fuente: "app", contrato: { obraId: req.params.id } },
      select: { id: true },
    });
    if (!cert) return res.status(404).json({ error: "Certificación no encontrada" });
    const existing = await prisma.comprobanteCert.findFirst({
      where: { id: req.params.compId, certificacionId: cert.id },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "Comprobante no encontrado" });

    const b = req.body as {
      tipo?: string; numero?: string | null; monto?: number; fecha?: string;
      fechaCobro?: string | null; retencion?: number | null; nota?: string | null;
    };
    const data: Record<string, unknown> = {};
    if (b.tipo !== undefined) {
      if (!COMP_TIPOS.includes(b.tipo)) return res.status(400).json({ error: "tipo inválido" });
      data.tipo = b.tipo;
    }
    if (b.numero !== undefined) data.numero = b.numero || null;
    if (b.monto !== undefined) data.monto = Number(b.monto).toFixed(2);
    if (b.fecha !== undefined) data.fecha = new Date(b.fecha);
    if (b.fechaCobro !== undefined) data.fechaCobro = b.fechaCobro ? new Date(b.fechaCobro) : null;
    if (b.retencion !== undefined) data.retencion = b.retencion != null ? Number(b.retencion).toFixed(2) : null;
    if (b.nota !== undefined) data.nota = b.nota || null;

    const comp = await prisma.comprobanteCert.update({ where: { id: existing.id }, data });
    await recomputeEstadoCobranza(cert.id);
    res.json(serializeComp(comp));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al actualizar comprobante" });
  }
});

// DELETE .../comprobantes/:compId
router.delete("/:id/certificaciones/:certId/comprobantes/:compId", async (req: Request, res: Response) => {
  try {
    const cert = await prisma.certificacion.findFirst({
      where: { id: req.params.certId, fuente: "app", contrato: { obraId: req.params.id } },
      select: { id: true },
    });
    if (!cert) return res.status(404).json({ error: "Certificación no encontrada" });
    const existing = await prisma.comprobanteCert.findFirst({
      where: { id: req.params.compId, certificacionId: cert.id },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "Comprobante no encontrado" });
    await prisma.comprobanteCert.delete({ where: { id: existing.id } });
    await recomputeEstadoCobranza(cert.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al borrar comprobante" });
  }
});

// ─── Control financiero ────────────────────────────────────────────────────────

function acum(map: Map<string, number>, key: string, value: number) {
  map.set(key, (map.get(key) ?? 0) + value);
}

// GET /api/obras/:id/control
// Dashboard completo: margen, bloques, flujo de caja, certificación, alertas
router.get("/:id/control", async (req: Request, res: Response) => {
  try {
    const obraId = req.params.id;
    const obra = await prisma.obra.findUnique({
      where: { id: obraId },
      select: { id: true, nombre: true, codigo: true },
    });
    if (!obra) { res.status(404).json({ error: "Obra no encontrada" }); return; }

    let header = await prisma.presupuestoHeader.findFirst({
      where: { obraId, estado: "vigente", tipo: "APROBADO" },
      orderBy: { createdAt: "desc" },
      select: { id: true, tipo: true, nombre: true, cacValor: true },
    });
    if (!header) {
      header = await prisma.presupuestoHeader.findFirst({
        where: { obraId, estado: "vigente" },
        orderBy: { createdAt: "desc" },
        select: { id: true, tipo: true, nombre: true, cacValor: true },
      });
    }

    // Traer todo en paralelo
    const [lineas, movimientos, contratos, gastos, indicesCac] = await Promise.all([
      header
        ? prisma.lineaPresupuesto.findMany({
            where: { obraId, presupuestoHeaderId: header.id },
            select: { cantidad: true, costoMtUd: true, costoMoOtrUd: true, costoMoAlbUd: true,
                      rubroMt: true, rubroMoOtr: true, rubroMoAlb: true,
                      pctCertificado: true, pvMtUd: true, precioVenta: true },
          })
        : Promise.resolve([]),
      prisma.movimiento.findMany({
        where: { obraId },
        select: { fecha: true, debe: true, haber: true, rubroContable: { select: { nombre: true } } },
      }),
      prisma.contratoCliente.findMany({
        where: { obraId },
        select: { presupuestoAprobado: true, pctAnticipo: true,
                  certificaciones: { select: { fecha: true, baseBruta: true, estado: true } } },
      }),
      prisma.gastoDirInd.findMany({ where: { obraId }, select: { fecha: true, tipo: true, monto: true } }),
      prisma.indiceCAC.findMany({ where: { esPrevision: false }, select: { mes: true, valorIndec: true } }),
    ]);

    // ── Deflación CAC ────────────────────────────────────────────────────────────
    // El control compara presupuesto (a precios base) contra el gasto DESCONTADO:
    //   descontado(mov) = real × ratio(mes),  ratio(mes) = CAC_base / CAC(mes).
    // Neutraliza la inflación para comparar contra el presupuesto. (LOGICA_CALCULO §0-1.)
    const cacBase = Number(header?.cacValor ?? 0);
    const cacPorMes = new Map<string, number>(); // "yyyy-mm" → valor INDEC
    for (const r of indicesCac) {
      cacPorMes.set(r.mes.toISOString().slice(0, 7), Number(r.valorIndec));
    }
    const ratioMes = (yyyymm: string): number => {
      const cac = cacPorMes.get(yyyymm);
      return cacBase > 0 && cac && cac > 0 ? cacBase / cac : 1;
    };
    const deflacionAplicada = cacBase > 0 && cacPorMes.size > 0;

    // ── Rubros ──────────────────────────────────────────────────────────────────
    const pptoMap = new Map<string, number>();
    for (const l of lineas) {
      const c = Number(l.cantidad);
      if (l.rubroMt) acum(pptoMap, l.rubroMt, Number(l.costoMtUd ?? 0) * c);
      if (l.rubroMoOtr) acum(pptoMap, l.rubroMoOtr, Number(l.costoMoOtrUd ?? 0) * c);
      if (l.rubroMoAlb) acum(pptoMap, l.rubroMoAlb, Number(l.costoMoAlbUd ?? 0) * c);
    }
    const realMap = new Map<string, number>();
    const descontadoMap = new Map<string, number>();
    for (const m of movimientos) {
      const r = m.rubroContable?.nombre;
      if (!r) continue;
      const real = Number(m.debe) - Number(m.haber);
      acum(realMap, r, real);
      acum(descontadoMap, r, real * ratioMes(m.fecha.toISOString().slice(0, 7)));
    }
    type Semaforo = "ok" | "alerta" | "critico" | "sin_dato";
    const rubros = Array.from(new Set([...pptoMap.keys(), ...realMap.keys()])).map((rubro) => {
      const presupuestado = pptoMap.get(rubro) ?? 0;
      const gastado = realMap.get(rubro) ?? 0;
      const gastadoDescontado = descontadoMap.get(rubro) ?? 0;
      // Desvío y semáforo sobre el gasto DESCONTADO (lógica validada por el cliente).
      const desvio = gastadoDescontado - presupuestado;
      const pctDesvio = presupuestado !== 0 ? desvio / presupuestado : 0;
      let semaforo: Semaforo;
      if (!realMap.has(rubro)) semaforo = "sin_dato";
      else if (pctDesvio <= 0.05) semaforo = "ok";
      else if (pctDesvio <= 0.10) semaforo = "alerta";
      else semaforo = "critico";
      return { rubro, presupuestado, gastado, gastadoDescontado, desvio, pctDesvio, semaforo };
    });
    rubros.sort((a, b) => b.presupuestado - a.presupuestado);

    const totPresupuestado = rubros.reduce((s, r) => s + r.presupuestado, 0);
    const totGastado = rubros.reduce((s, r) => s + r.gastado, 0);
    const totGastadoDescontado = rubros.reduce((s, r) => s + r.gastadoDescontado, 0);
    const totDesvio = totGastadoDescontado - totPresupuestado;
    const pctConsumo = totPresupuestado > 0 ? totGastadoDescontado / totPresupuestado : 0;

    // Avance físico ponderado
    let numAv = 0, denAv = 0;
    for (const l of lineas) {
      const c = Number(l.cantidad);
      const pv = Number(l.pvMtUd ?? l.precioVenta ?? 0);
      numAv += Number(l.pctCertificado ?? 0) * pv * c;
      denAv += pv * c;
    }
    const pctAvanceFisico = denAv > 0 ? numAv / denAv : 0;

    // ── Margen de obra ───────────────────────────────────────────────────────────
    const venta = contratos.reduce((s, c) => s + Number(c.presupuestoAprobado), 0);
    const pctMargen = venta > 0 ? (venta - totGastado) / venta : 0;

    // ── Bloques ──────────────────────────────────────────────────────────────────
    const gastosPorTipo = new Map<string, number>();
    for (const g of gastos) acum(gastosPorTipo, g.tipo, Number(g.monto));

    const bloques = [
      { nombre: "Costo de Obra", presupuestado: totPresupuestado, gastado: totGastado,
        gastadoDescontado: totGastadoDescontado,
        pctConsumo: totPresupuestado > 0 ? totGastadoDescontado / totPresupuestado : null },
      ...Array.from(gastosPorTipo.entries()).map(([tipo, monto]) => ({
        nombre: `Gastos ${tipo}`, presupuestado: null as number | null,
        gastado: monto, pctConsumo: null as number | null,
      })),
    ];

    // ── Flujo de caja ────────────────────────────────────────────────────────────
    const allCerts = contratos.flatMap((c) => c.certificaciones);
    const ingByMes = new Map<string, number>();
    for (const cert of allCerts) {
      if (!cert.fecha) continue;
      acum(ingByMes, cert.fecha.toISOString().slice(0, 7), Number(cert.baseBruta));
    }
    const egByMes = new Map<string, number>();
    for (const m of movimientos) acum(egByMes, m.fecha.toISOString().slice(0, 7), Number(m.debe) - Number(m.haber));
    for (const g of gastos) acum(egByMes, g.fecha.toISOString().slice(0, 7), Number(g.monto));

    const mesesList = Array.from(new Set([...ingByMes.keys(), ...egByMes.keys()])).sort();
    let acum_ = 0;
    const flujoCaja = mesesList.map((mes) => {
      const ingresos = ingByMes.get(mes) ?? 0;
      const egresos = egByMes.get(mes) ?? 0;
      acum_ += ingresos - egresos;
      return { mes, ingresos, egresos, neto: ingresos - egresos, acumulado: acum_ };
    });
    const valleCaja = flujoCaja.length > 0 ? Math.min(...flujoCaja.map((f) => f.acumulado), 0) : 0;
    const mesesNegCaja = flujoCaja.filter((f) => f.acumulado < 0).length;
    const resultadoAcum = acum_;
    const totalEgresos = flujoCaja.reduce((s, f) => s + f.egresos, 0);

    // ── Certificación ────────────────────────────────────────────────────────────
    const totalCertificado = allCerts.reduce((s, c) => s + Number(c.baseBruta), 0);
    const cobrado = allCerts.filter((c) => c.estado === "cobrado" || c.estado === "pagado")
                            .reduce((s, c) => s + Number(c.baseBruta), 0);
    const anticipo = contratos.reduce((s, c) => s + Number(c.pctAnticipo) * Number(c.presupuestoAprobado), 0);

    // ── Alertas ──────────────────────────────────────────────────────────────────
    const alertas: Array<{ nivel: string; mensaje: string }> = [];
    const rubrosDesvio = rubros.filter((r) => r.pctDesvio > 0.10 && r.desvio > 1_000_000);
    if (rubrosDesvio.length > 0)
      alertas.push({ nivel: "critico", mensaje: `${rubrosDesvio.length} rubro(s) con desvío (descontado) >10% y >$1M` });
    if (pctConsumo > 0.9)
      alertas.push({ nivel: "critico", mensaje: `Consumo del ${(pctConsumo * 100).toFixed(0)}% del presupuesto` });
    if (valleCaja < -5_000_000)
      alertas.push({ nivel: "atencion", mensaje: `Valle de caja negativo: -$${(Math.abs(valleCaja) / 1_000_000).toFixed(1)}M` });
    if (mesesNegCaja > 0)
      alertas.push({ nivel: "info", mensaje: `${mesesNegCaja} mes(es) con caja negativa` });

    res.json({
      obra,
      presupuestoHeader: header ? { id: header.id, tipo: header.tipo, nombre: header.nombre ?? null } : null,
      margen: { venta, costoReal: totGastado, costoDescontado: totGastadoDescontado,
                margen: venta - totGastado, pctMargen, resultadoAcum },
      cac: { base: cacBase, deflacionAplicada },
      totales: { presupuestado: totPresupuestado, gastado: totGastado,
                 gastadoDescontado: totGastadoDescontado, desvio: totDesvio,
                 pctDesvio: totPresupuestado !== 0 ? totDesvio / totPresupuestado : 0,
                 pctConsumo, pctAvanceFisico },
      bloques, rubros, flujoCaja,
      flujoCajaMeta: { resultadoAcum, valleCaja, mesesNegCaja, cobrado, egresos: totalEgresos },
      certificacion: { totalCertificado, pctFisico: venta > 0 ? totalCertificado / venta : pctAvanceFisico,
                       anticipo, cobrado, pendienteCobro: totalCertificado - cobrado },
      alertas,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al obtener control" });
  }
});

// GET /api/obras/:id/movimientos
// Listado paginado de movimientos con filtros opcionales
router.get("/:id/movimientos", async (req: Request, res: Response) => {
  try {
    const obraId = req.params.id;
    const obra = await prisma.obra.findUnique({ where: { id: obraId }, select: { id: true } });
    if (!obra) { res.status(404).json({ error: "Obra no encontrada" }); return; }

    const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10) || 1);
    const perPage = Math.min(200, Math.max(1, parseInt((req.query.perPage as string) ?? "50", 10) || 50));
    const desde = req.query.desde as string | undefined;
    const hasta = req.query.hasta as string | undefined;
    const rubroNombre = req.query.rubro as string | undefined;

    const where = {
      obraId,
      ...(desde || hasta ? { fecha: { ...(desde ? { gte: new Date(desde) } : {}), ...(hasta ? { lte: new Date(hasta) } : {}) } } : {}),
      ...(rubroNombre ? { rubroContable: { nombre: rubroNombre } } : {}),
    };

    const [total, items] = await Promise.all([
      prisma.movimiento.count({ where }),
      prisma.movimiento.findMany({
        where,
        include: {
          rubroContable: { select: { nombre: true } },
          subcontrato: { select: { contratoId: true } },
        },
        orderBy: { fecha: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    res.json({ items, total, page, perPage });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al obtener movimientos" });
  }
});

// GET /api/obras/:id/subcontratos
// Lista de subcontratos de la obra ordenados por montoPpto desc
router.get("/:id/subcontratos", async (req: Request, res: Response) => {
  try {
    const obraId = req.params.id;
    const obra = await prisma.obra.findUnique({ where: { id: obraId }, select: { id: true } });
    if (!obra) { res.status(404).json({ error: "Obra no encontrada" }); return; }

    const subcontratos = await prisma.subcontratoObra.findMany({
      where: { obraId },
      orderBy: { montoPpto: "desc" },
    });

    res.json(subcontratos);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al obtener subcontratos" });
  }
});

// DELETE /api/obras/:id
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const obraId = req.params.id;
    const obra = await prisma.obra.findUnique({ where: { id: obraId }, select: { id: true } });
    if (!obra) { res.status(404).json({ error: "Obra no encontrada" }); return; }

    // Borrar en orden las relaciones sin onDelete: Cascade
    await prisma.$transaction([
      // LineaCronograma cascada desde LineaPresupuesto — alcanza con borrar las lineas
      prisma.lineaPresupuesto.deleteMany({ where: { obraId } }),
      prisma.presupuestoHeader.deleteMany({ where: { obraId } }),
      // Partidas scope OBRA (las globales no tocar)
      prisma.partida.deleteMany({ where: { obraId } }),
      // El resto (Movimiento, ContratoCliente→Certificacion, SubcontratoObra, Quincena, GastoDirInd)
      // se borra por cascade al eliminar la obra
      prisma.obra.delete({ where: { id: obraId } }),
    ]);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al eliminar obra" });
  }
});

export default router;

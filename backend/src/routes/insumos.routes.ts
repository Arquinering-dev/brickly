import { Router, Request, Response } from "express";
import prisma from "../prisma/client";
import { calcCantInsumo } from "../lib/composicion";
import { getLatestIccRaw } from "../lib/icc";
import { categorizeInsumos, persistCategorias } from "../services/ai/categorizer";
import { isGeminiConfigured } from "../services/ai/gemini.client";

const VALID_TIPOS = new Set(["MATERIAL", "MANO_DE_OBRA", "EQUIPO", "SUBCONTRATO"]);
type TipoInsumo = "MATERIAL" | "MANO_DE_OBRA" | "EQUIPO" | "SUBCONTRATO";

const router = Router();

// GET /api/insumos/proyeccion?obraId=&tipo=
// Proyección de insumos necesarios por MES CALENDARIO, consolidada entre obras.
// Para cada línea con partida APU y cronograma: por cada mes, cantidad de tarea ejecutada
// (cantidad × pctEjecucion) × composición → cantidad de cada insumo. Se alinea por mes
// calendario (YYYY-MM) para que "mes 3 de GDR" y "mes 7 de Chivilcoy" sumen si caen en el
// mismo mes real. Las líneas SIN partida (cotización directa) no explotan en insumos: se
// reportan como cobertura faltante para ser honestos sobre qué cubre la proyección.
router.get("/proyeccion", async (req: Request, res: Response) => {
  try {
    const obraIdFilter = req.query.obraId as string | undefined;
    const tipoFilter = req.query.tipo as string | undefined;
    // rubros: lista separada por "|" (los nombres pueden tener comas). Vacío = todos.
    const rubrosParam = (req.query.rubros as string | undefined)?.trim();
    const rubrosFilter = rubrosParam ? new Set(rubrosParam.split("|").map((r) => r.trim()).filter(Boolean)) : null;

    const allObras = await prisma.obra.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, nombre: true, codigo: true },
    });
    const targetObras = obraIdFilter ? allObras.filter((o) => o.id === obraIdFilter) : allObras;

    type Celda = { cantidad: number; monto: number };
    type InsumoAgg = {
      codigo: string;
      descripcion: string;
      tipo: string;
      unidad: string;
      categoria: string | null;
      precioUnitario: number;
      porMes: Map<string, Celda>;
      porRubro: Map<string, Celda>;
      totalCantidad: number;
      totalMonto: number;
    };

    const insumosMap = new Map<string, InsumoAgg>();
    const mesesMap = new Map<string, Date>();      // YYYY-MM → fecha representativa
    const totalMontoPorMes = new Map<string, number>();
    const rubrosSet = new Set<string>();           // todos los rubros del alcance (para el filtro)

    // Qué obras tienen datos proyectables (línea con partida + cronograma) — sobre TODAS las
    // obras, independiente del filtro, para que los pills de selección no se deshabiliten mal.
    const lineasConDatos = await prisma.lineaPresupuesto.findMany({
      where: { partidaId: { not: null }, cronograma: { some: {} } },
      select: { obraId: true },
      distinct: ["obraId"],
    });
    const obrasConDatos = lineasConDatos.map((l) => l.obraId);

    // Cobertura: costo directo de líneas con composición APU vs total (para ser honestos)
    let cdConComposicion = 0;
    let cdTotal = 0;

    for (const obra of targetObras) {
      // Preferir APROBADO (trae cronograma + precio de venta congelado); si no, el vigente más reciente
      const header =
        (await prisma.presupuestoHeader.findFirst({
          where: { obraId: obra.id, estado: "vigente", tipo: "APROBADO" },
          orderBy: { createdAt: "desc" }, select: { id: true },
        })) ??
        (await prisma.presupuestoHeader.findFirst({
          where: { obraId: obra.id, estado: "vigente" },
          orderBy: { createdAt: "desc" }, select: { id: true },
        }));
      if (!header) continue;

      const lineas = await prisma.lineaPresupuesto.findMany({
        where: { obraId: obra.id, presupuestoHeaderId: header.id },
        include: {
          cronograma: { select: { fecha: true, pctEjecucion: true } },
          partida: { include: { composiciones: { include: { insumo: true } } } },
        },
      });

      for (const linea of lineas) {
        const rubro = linea.rubro ?? "GENERAL";
        rubrosSet.add(rubro);
        // Filtro por rubro (se registra en rubrosSet antes de saltear para no perder la opción)
        if (rubrosFilter && !rubrosFilter.has(rubro)) continue;

        const cant = Number(linea.cantidad);
        const cdLinea = cant * Number(linea.precioUnitarioSnapshot);
        cdTotal += cdLinea;

        const comps = linea.partida?.composiciones ?? [];
        if (comps.length === 0 || linea.cronograma.length === 0) continue;
        cdConComposicion += cdLinea;

        const rend = linea.partida?.rendimiento ? Number(linea.partida.rendimiento) : null;

        for (const c of linea.cronograma) {
          const mes = c.fecha.toISOString().slice(0, 7); // YYYY-MM
          if (!mesesMap.has(mes)) mesesMap.set(mes, c.fecha);
          const cantDelMes = cant * Number(c.pctEjecucion);
          if (cantDelMes === 0) continue;

          for (const comp of comps) {
            const tipoIns = comp.insumo.tipo;
            if (tipoFilter && VALID_TIPOS.has(tipoFilter) && tipoIns !== tipoFilter) continue;

            const cantInsumo = calcCantInsumo(
              tipoIns,
              Number(comp.cantidadPorUnidad),
              Number(comp.pctDesperdicio),
              rend,
              cantDelMes,
            );
            if (cantInsumo === 0) continue;
            const monto = cantInsumo * Number(comp.insumo.precioReferencia);

            let agg = insumosMap.get(comp.insumo.codigo);
            if (!agg) {
              agg = {
                codigo: comp.insumo.codigo,
                descripcion: comp.insumo.descripcion,
                tipo: tipoIns,
                unidad: comp.insumo.unidad,
                categoria: comp.insumo.categoriaCanonica ?? comp.insumo.categoria ?? null,
                precioUnitario: Number(comp.insumo.precioReferencia),
                porMes: new Map(),
                porRubro: new Map(),
                totalCantidad: 0,
                totalMonto: 0,
              };
              insumosMap.set(comp.insumo.codigo, agg);
            }
            const celda = agg.porMes.get(mes) ?? { cantidad: 0, monto: 0 };
            celda.cantidad += cantInsumo;
            celda.monto += monto;
            agg.porMes.set(mes, celda);
            const celdaR = agg.porRubro.get(rubro) ?? { cantidad: 0, monto: 0 };
            celdaR.cantidad += cantInsumo;
            celdaR.monto += monto;
            agg.porRubro.set(rubro, celdaR);
            agg.totalCantidad += cantInsumo;
            agg.totalMonto += monto;

            totalMontoPorMes.set(mes, (totalMontoPorMes.get(mes) ?? 0) + monto);
          }
        }
      }
    }

    const meses = [...mesesMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, fecha]) => ({
        mes,
        fecha: fecha.toISOString(),
        label: fecha.toLocaleDateString("es-AR", { month: "short", year: "2-digit" }),
      }));

    const tipoOrder = ["MATERIAL", "SUBCONTRATO", "EQUIPO", "MANO_DE_OBRA"];
    const insumos = [...insumosMap.values()]
      .map((a) => ({
        codigo: a.codigo,
        descripcion: a.descripcion,
        tipo: a.tipo,
        unidad: a.unidad,
        categoria: a.categoria,
        precioUnitario: a.precioUnitario,
        porMes: Object.fromEntries(a.porMes),
        porRubro: Object.fromEntries(a.porRubro),
        totalCantidad: a.totalCantidad,
        totalMonto: a.totalMonto,
      }))
      .sort((a, b) => {
        const ta = tipoOrder.indexOf(a.tipo);
        const tb = tipoOrder.indexOf(b.tipo);
        if (ta !== tb) return ta - tb;
        return b.totalMonto - a.totalMonto;
      });

    const rubros = [...rubrosSet].sort((a, b) =>
      a.localeCompare(b, "es", { numeric: true, sensitivity: "base" }),
    );

    res.json({
      obras: allObras,
      obrasConDatos,
      meses,
      rubros,
      insumos,
      totalMontoPorMes: Object.fromEntries(totalMontoPorMes),
      cobertura: {
        cdConComposicion,
        cdTotal,
        pct: cdTotal > 0 ? cdConComposicion / cdTotal : 0,
      },
      filtros: { obraId: obraIdFilter ?? null, tipo: tipoFilter ?? null, rubros: rubrosFilter ? [...rubrosFilter] : null },
      icc: await getLatestIccRaw(),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al obtener proyección" });
  }
});

// POST /api/insumos/categorizar?todos=true
// Backfill: asigna categoriaCanonica con Gemini a los insumos que no la tienen (o a todos si
// ?todos=true). Write-time, persistido. No-op seguro si GEMINI_API_KEY no está configurada.
router.post("/categorizar", async (req: Request, res: Response) => {
  try {
    if (!isGeminiConfigured()) {
      return res.status(200).json({ configurada: false, candidatos: 0, categorizadas: 0 });
    }
    const todos = req.query.todos === "true";
    const insumos = await prisma.insumo.findMany({
      where: todos ? {} : { categoriaCanonica: null },
      select: { codigo: true, descripcion: true, tipo: true, unidad: true, categoria: true },
    });
    if (insumos.length === 0) {
      return res.json({ configurada: true, candidatos: 0, categorizadas: 0 });
    }
    const map = await categorizeInsumos(insumos);
    const categorizadas = await persistCategorias(map);
    res.json({ configurada: true, candidatos: insumos.length, categorizadas });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al categorizar" });
  }
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const tipo = req.query.tipo as string | undefined;
    const search = req.query.search as string | undefined;

    const insumos = await prisma.insumo.findMany({
      where: {
        ...(tipo && VALID_TIPOS.has(tipo) ? { tipo: tipo as TipoInsumo } : {}),
        ...(search
          ? {
              OR: [
                { codigo: { contains: search, mode: "insensitive" } },
                { descripcion: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { codigo: "asc" },
    });
    res.json(insumos);
  } catch {
    res.status(500).json({ error: "Error al listar insumos" });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { descripcion, unidad, precioReferencia, proveedor, categoria } = req.body as {
      descripcion?: string;
      unidad?: string;
      precioReferencia?: number | string;
      proveedor?: string | null;
      categoria?: string | null;
    };

    const data: Record<string, unknown> = {};
    if (descripcion !== undefined) data.descripcion = descripcion;
    if (unidad !== undefined) data.unidad = unidad;
    if (precioReferencia !== undefined) data.precioReferencia = precioReferencia;
    if (proveedor !== undefined) data.proveedor = proveedor;
    if (categoria !== undefined) data.categoria = categoria;

    const insumo = await prisma.insumo.update({ where: { id }, data });
    res.json(insumo);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Error al actualizar insumo" });
  }
});

export default router;

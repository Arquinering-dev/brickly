import { Router, Request, Response } from "express";
import prisma from "../prisma/client";
import { getLatestIccRaw, calcCoefICC } from "../lib/icc";

const router = Router();

// Lista resumen de todos los presupuestos (generador + aprobado)
router.get("/", async (req: Request, res: Response) => {
  try {
    const tipo = req.query.tipo as string | undefined;
    const obraId = req.query.obraId as string | undefined;

    const headers = await prisma.presupuestoHeader.findMany({
      where: {
        ...(tipo ? { tipo: tipo as "GENERADOR" | "APROBADO" } : {}),
        ...(obraId ? { obraId } : {}),
      },
      include: {
        obra: { select: { id: true, nombre: true, codigo: true, estado: true } },
        _count: { select: { lineas: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const latestIcc = await getLatestIccRaw();

    const enriched = await Promise.all(
      headers.map(async (h) => {
        const agg = await prisma.lineaPresupuesto.aggregate({
          where: { presupuestoHeaderId: h.id },
          _count: { id: true },
        });
        const lineas = await prisma.lineaPresupuesto.findMany({
          where: { presupuestoHeaderId: h.id },
          select: { cantidad: true, precioUnitarioSnapshot: true, precioVenta: true, rubro: true },
        });
        let totalCD = 0;
        let totalPV = 0;
        const rubrosSet = new Set<string>();
        for (const l of lineas) {
          totalCD += Number(l.precioUnitarioSnapshot) * Number(l.cantidad);
          totalPV += Number(l.precioVenta ?? 0) * Number(l.cantidad);
          if (l.rubro) rubrosSet.add(l.rubro);
        }
        const cacValorNum = Number(h.cacValor);
        const coefICC = calcCoefICC(cacValorNum, latestIcc?.valorAbsoluto ?? null);
        return {
          id: h.id,
          obra: h.obra,
          tipo: h.tipo,
          nombre: h.nombre,
          version: h.version,
          estado: h.estado,
          mesCac: h.mesCac,
          cacValor: cacValorNum,
          coefGGBB: h.coefGGBB ? Number(h.coefGGBB) : null,
          fecha: h.fecha,
          fechaInicio: h.fechaInicio,
          lineasCount: agg._count.id,
          rubrosCount: rubrosSet.size,
          totalCD,
          totalPV,
          createdAt: h.createdAt,
          icc: {
            base: cacValorNum,
            actual: latestIcc?.valorAbsoluto ?? null,
            coef: coefICC,
            mesBase: h.mesCac || null,
            mesActual: latestIcc?.mesLabel ?? null,
            variacionMensual: latestIcc?.variacionMensual ?? null,
          },
        };
      })
    );

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al listar presupuestos" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const header = await prisma.presupuestoHeader.findUnique({
      where: { id: req.params.id },
      include: {
        obra: true,
        lineas: {
          include: {
            partida: { include: { composiciones: { include: { insumo: true }, orderBy: { secuencia: "asc" } } } },
            cronograma: { orderBy: { mesOrdinal: "asc" } },
          },
          orderBy: { orden: "asc" },
        },
      },
    });
    if (!header) {
      res.status(404).json({ error: "Presupuesto no encontrado" });
      return;
    }
    const latestIcc = await getLatestIccRaw();
    const cacValorNum = Number(header.cacValor);
    res.json({
      ...header,
      cacValor: cacValorNum,
      coefGGBB: header.coefGGBB ? Number(header.coefGGBB) : null,
      icc: {
        base: cacValorNum,
        actual: latestIcc?.valorAbsoluto ?? null,
        coef: calcCoefICC(cacValorNum, latestIcc?.valorAbsoluto ?? null),
        mesBase: header.mesCac || null,
        mesActual: latestIcc?.mesLabel ?? null,
        variacionMensual: latestIcc?.variacionMensual ?? null,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al obtener presupuesto" });
  }
});

// Crear un presupuesto vacío (luego se le agregan líneas)
router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      obraId, tipo = "GENERADOR", nombre, version, mesCac = "",
      cacValor = 0, coefGGBB, fecha, fechaInicio,
    } = req.body as {
      obraId: string;
      tipo?: "GENERADOR" | "APROBADO";
      nombre?: string;
      version?: string;
      mesCac?: string;
      cacValor?: number;
      coefGGBB?: number;
      fecha?: string;
      fechaInicio?: string;
    };
    if (!obraId) {
      res.status(400).json({ error: "obraId es requerido" });
      return;
    }
    const header = await prisma.presupuestoHeader.create({
      data: {
        obraId,
        tipo,
        nombre: nombre ?? null,
        version: version ?? null,
        mesCac,
        cacValor,
        coefGGBB: coefGGBB ?? null,
        fecha: fecha ? new Date(fecha) : new Date(),
        fechaInicio: fechaInicio ? new Date(fechaInicio) : null,
      },
    });
    res.status(201).json(header);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al crear presupuesto" });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { nombre, version, mesCac, cacValor, coefGGBB, estado, fechaInicio } = req.body;
    const header = await prisma.presupuestoHeader.update({
      where: { id: req.params.id },
      data: {
        ...(nombre !== undefined && { nombre }),
        ...(version !== undefined && { version }),
        ...(mesCac !== undefined && { mesCac }),
        ...(cacValor !== undefined && { cacValor }),
        ...(coefGGBB !== undefined && { coefGGBB }),
        ...(estado !== undefined && { estado }),
        ...(fechaInicio !== undefined && { fechaInicio: fechaInicio ? new Date(fechaInicio) : null }),
      },
    });
    res.json(header);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al actualizar presupuesto" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    await prisma.$transaction([
      prisma.lineaCronograma.deleteMany({
        where: { linea: { presupuestoHeaderId: req.params.id } },
      }),
      prisma.lineaPresupuesto.deleteMany({ where: { presupuestoHeaderId: req.params.id } }),
      prisma.presupuestoHeader.delete({ where: { id: req.params.id } }),
    ]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al eliminar presupuesto" });
  }
});

// Reemplazar todas las líneas del presupuesto en un solo POST (bulk)
router.put("/:id/lineas", async (req: Request, res: Response) => {
  try {
    const headerId = req.params.id;
    const { lineas } = req.body as {
      lineas: Array<{
        partidaId?: string | null;
        cantidad: number;
        precioUnitarioSnapshot: number;
        precioVenta?: number | null;
        rubro: string;
        subRubro?: string | null;
        itemNumero?: string | null;
        orden?: number;
        descripcionLibre?: string | null;
        tipo?: "APU" | "SUBCONTRATO" | "COTIZACION_DIRECTA";
        matUd?: number | null;
        moUd?: number | null;
        eqUd?: number | null;
        fuente?: string | null;
        apuLinkCodigo?: string | null;
      }>;
    };
    if (!Array.isArray(lineas)) {
      res.status(400).json({ error: "lineas es requerido" });
      return;
    }

    const header = await prisma.presupuestoHeader.findUnique({ where: { id: headerId } });
    if (!header) {
      res.status(404).json({ error: "Presupuesto no encontrado" });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.lineaCronograma.deleteMany({ where: { linea: { presupuestoHeaderId: headerId } } });
      await tx.lineaPresupuesto.deleteMany({ where: { presupuestoHeaderId: headerId } });
      if (lineas.length > 0) {
        await tx.lineaPresupuesto.createMany({
          data: lineas.map((l, idx) => ({
            obraId: header.obraId,
            presupuestoHeaderId: headerId,
            partidaId: l.partidaId ?? null,
            cantidad: l.cantidad,
            precioUnitarioSnapshot: l.precioUnitarioSnapshot,
            precioVenta: l.precioVenta ?? null,
            rubro: l.rubro,
            subRubro: l.subRubro ?? null,
            itemNumero: l.itemNumero ?? null,
            orden: l.orden ?? idx,
            descripcionLibre: l.descripcionLibre ?? null,
            tipo: l.tipo ?? "APU",
            matUd: l.matUd ?? null,
            moUd: l.moUd ?? null,
            eqUd: l.eqUd ?? null,
            fuente: l.fuente ?? null,
            apuLinkCodigo: l.apuLinkCodigo ?? null,
          })),
        });
      }
    });

    res.json({ ok: true, count: lineas.length });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al guardar líneas" });
  }
});

export default router;

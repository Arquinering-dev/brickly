import { Router, Request, Response } from "express";
import multer from "multer";
import prisma from "../prisma/client";
import { parsePresupuestoXlsx } from "../services/presupuesto-parser.service";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

type FilaInput = {
  lineaId?: string | null;
  partidaId?: string | null;
  itemNumero?: string | null;
  rubro: string;
  descripcion: string;
  cantidad: number;
  pctPorMes: number[];
};

// ─── PARSE XLSX (preview cronograma) ─────────────────────────────────────────
// POST /api/planificacion/parse-xlsx — multipart file
// Reusa el parser de presupuesto-aprobado (que ya detecta MES 0..N).
// Devuelve obra detectada + matriz de filas con pct por mes.
router.post("/parse-xlsx", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No se recibió ningún archivo" });
      return;
    }
    const preview = await parsePresupuestoXlsx(req.file.buffer, { tipo: "APROBADO" });
    if (preview.cronogramaMeses.length === 0) {
      res.status(422).json({
        error: "El archivo no contiene un cronograma mes a mes (columnas MES 0, MES 1, ...)",
        preview,
      });
      return;
    }
    res.json(preview);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al parsear archivo" });
  }
});

// ─── CREAR DESDE XLSX PARSEADO ───────────────────────────────────────────────
// POST /api/planificacion/from-xlsx
// Body: { obraId, nombre, fechaInicio, duracionMeses, filas: [{ itemNumero, rubro, descripcion, cantidad, pctPorMes }] }
router.post("/from-xlsx", async (req: Request, res: Response) => {
  try {
    const { obraId, nombre, fechaInicio, duracionMeses, filas } = req.body as {
      obraId: string;
      nombre: string;
      fechaInicio: string;
      duracionMeses: number;
      filas: Array<{
        itemNumero?: string | null;
        rubro: string;
        descripcion: string;
        cantidad: number;
        pctPorMes: number[];
      }>;
    };
    if (!obraId || !nombre || !fechaInicio || !duracionMeses || !Array.isArray(filas)) {
      res.status(400).json({ error: "Faltan campos requeridos" });
      return;
    }

    const plan = await prisma.planificacion.create({
      data: { obraId, nombre, fechaInicio: new Date(fechaInicio), duracionMeses },
    });

    if (filas.length > 0) {
      await prisma.planificacionFila.createMany({
        data: filas.map((f) => ({
          planificacionId: plan.id,
          itemNumero: f.itemNumero ?? null,
          rubro: f.rubro,
          descripcion: f.descripcion,
          cantidad: f.cantidad,
          pctPorMes: f.pctPorMes,
        })),
      });
    }

    const full = await prisma.planificacion.findUnique({
      where: { id: plan.id },
      include: { obra: true, filas: true },
    });
    res.status(201).json(full);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al crear planificación" });
  }
});

// ─── LISTA ───────────────────────────────────────────────────────────────────
router.get("/", async (_req: Request, res: Response) => {
  try {
    const items = await prisma.planificacion.findMany({
      include: {
        obra: { select: { id: true, nombre: true, codigo: true } },
        _count: { select: { filas: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al listar" });
  }
});

// ─── DETALLE ─────────────────────────────────────────────────────────────────
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const plan = await prisma.planificacion.findUnique({
      where: { id: req.params.id },
      include: {
        obra: true,
        filas: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!plan) {
      res.status(404).json({ error: "Planificación no encontrada" });
      return;
    }
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

// ─── CREAR (pre-llenado opcional desde presupuesto aprobado) ─────────────────
// Body: { obraId, nombre, fechaInicio, duracionMeses, fromHeaderId? }
router.post("/", async (req: Request, res: Response) => {
  try {
    const { obraId, nombre, fechaInicio, duracionMeses, fromHeaderId } = req.body as {
      obraId: string;
      nombre: string;
      fechaInicio: string;
      duracionMeses: number;
      fromHeaderId?: string;
    };
    if (!obraId || !nombre || !fechaInicio || !duracionMeses) {
      res.status(400).json({ error: "obraId, nombre, fechaInicio y duracionMeses son requeridos" });
      return;
    }

    // Crear planificación
    const plan = await prisma.planificacion.create({
      data: {
        obraId,
        nombre,
        fechaInicio: new Date(fechaInicio),
        duracionMeses,
      },
    });

    // Pre-llenar filas desde un presupuesto (aprobado preferentemente)
    let header = fromHeaderId
      ? await prisma.presupuestoHeader.findUnique({ where: { id: fromHeaderId } })
      : await prisma.presupuestoHeader.findFirst({
          where: { obraId, tipo: "APROBADO", estado: "vigente" },
          orderBy: { createdAt: "desc" },
        });
    if (!header) {
      header = await prisma.presupuestoHeader.findFirst({
        where: { obraId, estado: "vigente" },
        orderBy: { createdAt: "desc" },
      });
    }

    if (header) {
      const lineas = await prisma.lineaPresupuesto.findMany({
        where: { presupuestoHeaderId: header.id },
        include: {
          partida: { select: { descripcion: true } },
          cronograma: { orderBy: { mesOrdinal: "asc" } },
        },
        orderBy: { orden: "asc" },
      });
      const filasData = lineas.map((l) => {
        const pct = new Array(duracionMeses).fill(0);
        // Pre-llenar desde cronograma del aprobado si existe
        for (const c of l.cronograma) {
          if (c.mesOrdinal >= 0 && c.mesOrdinal < duracionMeses) {
            pct[c.mesOrdinal] = Number(c.pctEjecucion);
          }
        }
        return {
          planificacionId: plan.id,
          lineaId: l.id,
          partidaId: l.partidaId,
          itemNumero: l.itemNumero,
          rubro: l.rubro,
          descripcion: l.partida?.descripcion ?? l.descripcionLibre ?? "",
          cantidad: l.cantidad,
          pctPorMes: pct,
        };
      });
      if (filasData.length > 0) {
        await prisma.planificacionFila.createMany({ data: filasData });
      }
    }

    const full = await prisma.planificacion.findUnique({
      where: { id: plan.id },
      include: { obra: true, filas: true },
    });
    res.status(201).json(full);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al crear planificación" });
  }
});

// ─── ACTUALIZAR (nombre, duración, fechaInicio, filas) ───────────────────────
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { nombre, fechaInicio, duracionMeses, estado, filas } = req.body as {
      nombre?: string;
      fechaInicio?: string;
      duracionMeses?: number;
      estado?: string;
      filas?: (FilaInput & { id?: string })[];
    };

    const updated = await prisma.planificacion.update({
      where: { id: req.params.id },
      data: {
        ...(nombre !== undefined && { nombre }),
        ...(fechaInicio !== undefined && { fechaInicio: new Date(fechaInicio) }),
        ...(duracionMeses !== undefined && { duracionMeses }),
        ...(estado !== undefined && { estado }),
      },
    });

    if (Array.isArray(filas)) {
      await prisma.$transaction([
        prisma.planificacionFila.deleteMany({ where: { planificacionId: req.params.id } }),
        prisma.planificacionFila.createMany({
          data: filas.map((f) => ({
            planificacionId: req.params.id,
            lineaId: f.lineaId ?? null,
            partidaId: f.partidaId ?? null,
            itemNumero: f.itemNumero ?? null,
            rubro: f.rubro,
            descripcion: f.descripcion,
            cantidad: f.cantidad,
            pctPorMes: f.pctPorMes,
          })),
        }),
      ]);
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al actualizar" });
  }
});

// ─── ELIMINAR ─────────────────────────────────────────────────────────────────
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    await prisma.planificacion.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al eliminar" });
  }
});

export default router;

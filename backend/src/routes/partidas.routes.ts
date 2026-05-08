import { Router, Request, Response } from "express";
import prisma from "../prisma/client";

const router = Router();

function qstr(val: unknown): string | undefined {
  if (typeof val === "string" && val.length > 0) return val;
  return undefined;
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const rubro = qstr(req.query.rubro);
    const tipo = qstr(req.query.tipo) as "APU" | "SUBCONTRATO" | "COTIZACION_DIRECTA" | undefined;
    const search = qstr(req.query.search);
    const activa = req.query.activa !== undefined ? req.query.activa !== "false" : undefined;

    const partidas = await prisma.partida.findMany({
      where: {
        ...(rubro ? { rubro } : {}),
        ...(tipo ? { tipo } : {}),
        ...(activa !== undefined ? { activa } : {}),
        ...(search
          ? {
              OR: [
                { codigo: { contains: search, mode: "insensitive" } },
                { descripcion: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: { _count: { select: { composiciones: true } } },
      orderBy: [{ rubro: "asc" }, { codigo: "asc" }],
    });
    res.json(partidas);
  } catch {
    res.status(500).json({ error: "Error al listar partidas" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const partida = await prisma.partida.findUnique({
      where: { id: req.params.id },
      include: {
        composiciones: {
          orderBy: { secuencia: "asc" },
          include: { insumo: true },
        },
      },
    });
    if (!partida) {
      res.status(404).json({ error: "Partida no encontrada" });
      return;
    }
    res.json(partida);
  } catch {
    res.status(500).json({ error: "Error al obtener partida" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const { codigo, descripcion, rubro, unidad, rendimiento, tipo } = req.body;
    if (!codigo || !descripcion) {
      res.status(400).json({ error: "codigo y descripcion son requeridos" });
      return;
    }
    const partida = await prisma.partida.create({
      data: {
        codigo,
        descripcion,
        rubro: rubro ?? "",
        unidad: unidad ?? "",
        rendimiento: rendimiento ?? null,
        tipo: tipo ?? "APU",
      },
    });
    res.status(201).json(partida);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error interno" });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { descripcion, rubro, unidad, rendimiento, tipo, activa } = req.body;
    const partida = await prisma.partida.update({
      where: { id: req.params.id },
      data: {
        ...(descripcion !== undefined && { descripcion }),
        ...(rubro !== undefined && { rubro }),
        ...(unidad !== undefined && { unidad }),
        ...(rendimiento !== undefined && { rendimiento }),
        ...(tipo !== undefined && { tipo }),
        ...(activa !== undefined && { activa }),
      },
    });
    res.json(partida);
  } catch {
    res.status(500).json({ error: "Error al actualizar partida" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    await prisma.partida.update({
      where: { id: req.params.id },
      data: { activa: false },
    });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Error al desactivar partida" });
  }
});

router.post("/:id/composicion", async (req: Request, res: Response) => {
  try {
    const { insumoId, cantidadPorUnidad, pctDesperdicio, secuencia } = req.body;
    if (!insumoId) {
      res.status(400).json({ error: "insumoId es requerido" });
      return;
    }
    const comp = await prisma.composicion.create({
      data: {
        partidaId: req.params.id,
        insumoId,
        cantidadPorUnidad: cantidadPorUnidad ?? 0,
        pctDesperdicio: pctDesperdicio ?? 0,
        secuencia: secuencia ?? 0,
      },
      include: { insumo: true },
    });
    res.status(201).json(comp);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al agregar insumo" });
  }
});

router.put("/:id/composicion/:compId", async (req: Request, res: Response) => {
  try {
    const { cantidadPorUnidad, pctDesperdicio, secuencia } = req.body;
    const comp = await prisma.composicion.update({
      where: { id: req.params.compId },
      data: {
        ...(cantidadPorUnidad !== undefined && { cantidadPorUnidad }),
        ...(pctDesperdicio !== undefined && { pctDesperdicio }),
        ...(secuencia !== undefined && { secuencia }),
      },
      include: { insumo: true },
    });
    res.json(comp);
  } catch {
    res.status(500).json({ error: "Error al actualizar composición" });
  }
});

router.delete("/:id/composicion/:compId", async (req: Request, res: Response) => {
  try {
    await prisma.composicion.delete({ where: { id: req.params.compId } });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Error al eliminar insumo" });
  }
});

export default router;

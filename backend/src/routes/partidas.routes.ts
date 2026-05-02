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
    const search = qstr(req.query.search);
    const partidas = await prisma.partida.findMany({
      where: {
        ...(rubro ? { rubro } : {}),
        ...(search
          ? {
              OR: [
                { codigo: { contains: search, mode: "insensitive" } },
                { descripcion: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ rubro: "asc" }, { codigo: "asc" }],
    });
    res.json(partidas);
  } catch (err) {
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
          include: {
            material: true,
            manoDeObra: true,
            equipo: true,
          },
        },
      },
    });
    if (!partida) {
      res.status(404).json({ error: "Partida no encontrada" });
      return;
    }
    res.json(partida);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener partida" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      codigo, rubro, descripcion, unidad, rendimiento,
      pctDesperdicioConsumibles, pctDesperdicioGeneral,
      gradoDificultad, matUnitario, moUnitario, eqUnitario, cdUnitario, apuId,
    } = req.body;

    if (!codigo || !descripcion || !apuId) {
      res.status(400).json({ error: "codigo, descripcion y apuId son requeridos" });
      return;
    }

    const partida = await prisma.partida.create({
      data: {
        codigo, rubro: rubro || "", descripcion, unidad: unidad || "",
        rendimiento: rendimiento || 1,
        pctDesperdicioConsumibles: pctDesperdicioConsumibles || 0,
        pctDesperdicioGeneral: pctDesperdicioGeneral || 0,
        gradoDificultad: gradoDificultad || 1,
        matUnitario: matUnitario || 0,
        moUnitario: moUnitario || 0,
        eqUnitario: eqUnitario || 0,
        cdUnitario: cdUnitario || 0,
        apuId,
      },
    });
    res.status(201).json(partida);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    res.status(500).json({ error: message });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const {
      codigo, rubro, descripcion, unidad, rendimiento,
      pctDesperdicioConsumibles, pctDesperdicioGeneral,
      gradoDificultad, matUnitario, moUnitario, eqUnitario, cdUnitario,
    } = req.body;

    const partida = await prisma.partida.update({
      where: { id: req.params.id },
      data: {
        ...(codigo !== undefined && { codigo }),
        ...(rubro !== undefined && { rubro }),
        ...(descripcion !== undefined && { descripcion }),
        ...(unidad !== undefined && { unidad }),
        ...(rendimiento !== undefined && { rendimiento }),
        ...(pctDesperdicioConsumibles !== undefined && { pctDesperdicioConsumibles }),
        ...(pctDesperdicioGeneral !== undefined && { pctDesperdicioGeneral }),
        ...(gradoDificultad !== undefined && { gradoDificultad }),
        ...(matUnitario !== undefined && { matUnitario }),
        ...(moUnitario !== undefined && { moUnitario }),
        ...(eqUnitario !== undefined && { eqUnitario }),
        ...(cdUnitario !== undefined && { cdUnitario }),
      },
    });
    res.json(partida);
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar partida" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    await prisma.partida.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar partida" });
  }
});

// Composición endpoints
router.post("/:id/composicion", async (req: Request, res: Response) => {
  try {
    const { tipo, insumoId, cantidadPorUnidad, pctDesperdicio, secuencia } = req.body;
    if (!tipo || !insumoId) {
      res.status(400).json({ error: "tipo e insumoId son requeridos" });
      return;
    }
    const comp = await prisma.composicionPartida.create({
      data: {
        partidaId: req.params.id,
        tipo,
        insumoId,
        cantidadPorUnidad: cantidadPorUnidad || 0,
        pctDesperdicio: pctDesperdicio || 0,
        secuencia: secuencia || 0,
      },
      include: { material: true, manoDeObra: true, equipo: true },
    });
    res.status(201).json(comp);
  } catch (err) {
    res.status(500).json({ error: "Error al agregar insumo" });
  }
});

router.put("/:id/composicion/:compId", async (req: Request, res: Response) => {
  try {
    const { cantidadPorUnidad, pctDesperdicio, secuencia } = req.body;
    const comp = await prisma.composicionPartida.update({
      where: { id: req.params.compId },
      data: {
        ...(cantidadPorUnidad !== undefined && { cantidadPorUnidad }),
        ...(pctDesperdicio !== undefined && { pctDesperdicio }),
        ...(secuencia !== undefined && { secuencia }),
      },
      include: { material: true, manoDeObra: true, equipo: true },
    });
    res.json(comp);
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar insumo" });
  }
});

router.delete("/:id/composicion/:compId", async (req: Request, res: Response) => {
  try {
    await prisma.composicionPartida.delete({ where: { id: req.params.compId } });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar insumo" });
  }
});

export default router;

import { Router, Request, Response } from "express";
import prisma from "../prisma/client";

const router = Router();

router.get("/materiales", async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    const materiales = await prisma.material.findMany({
      where: search
        ? {
            OR: [
              { codigo: { contains: String(search), mode: "insensitive" } },
              { descripcion: { contains: String(search), mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { codigo: "asc" },
    });
    res.json(materiales);
  } catch {
    res.status(500).json({ error: "Error al listar materiales" });
  }
});

router.get("/mano-de-obra", async (_req: Request, res: Response) => {
  try {
    const mos = await prisma.manoDeObra.findMany({ orderBy: { codigo: "asc" } });
    res.json(mos);
  } catch {
    res.status(500).json({ error: "Error al listar mano de obra" });
  }
});

router.get("/equipos", async (_req: Request, res: Response) => {
  try {
    const equipos = await prisma.equipo.findMany({ orderBy: { codigo: "asc" } });
    res.json(equipos);
  } catch {
    res.status(500).json({ error: "Error al listar equipos" });
  }
});

export default router;

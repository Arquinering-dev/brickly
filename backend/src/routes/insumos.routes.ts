import { Router, Request, Response } from "express";
import prisma from "../prisma/client";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const tipo = req.query.tipo as string | undefined;
    const search = req.query.search as string | undefined;

    const insumos = await prisma.insumo.findMany({
      where: {
        ...(tipo ? { tipo: tipo as "MATERIAL" | "MANO_DE_OBRA" | "EQUIPO" | "SUBCONTRATO" } : {}),
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

export default router;

import { Router, Request, Response } from "express";
import prisma from "../prisma/client";

const VALID_TIPOS = new Set(["MATERIAL", "MANO_DE_OBRA", "EQUIPO", "SUBCONTRATO"]);
type TipoInsumo = "MATERIAL" | "MANO_DE_OBRA" | "EQUIPO" | "SUBCONTRATO";

const router = Router();

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

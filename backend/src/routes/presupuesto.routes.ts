import { Router, Request, Response } from "express";
import prisma from "../prisma/client";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const lineas = await prisma.presupuestoLinea.findMany({
      where: { estado: "activo" },
      include: {
        partida: { select: { codigo: true, descripcion: true, rubro: true, unidad: true } },
      },
      orderBy: [{ partida: { rubro: "asc" } }, { partida: { codigo: "asc" } }],
    });

    // Group by rubro
    const rubros = new Map<
      string,
      {
        rubro: string;
        matTotal: number;
        moTotal: number;
        eqTotal: number;
        total: number;
        partidas: typeof lineas;
      }
    >();

    for (const linea of lineas) {
      const rubro = linea.partida.rubro || "SIN RUBRO";
      if (!rubros.has(rubro)) {
        rubros.set(rubro, { rubro, matTotal: 0, moTotal: 0, eqTotal: 0, total: 0, partidas: [] });
      }
      const g = rubros.get(rubro)!;
      const mat = Number(linea.matTotal);
      const mo = Number(linea.moTotal);
      const eq = Number(linea.eqTotal);
      g.matTotal += mat;
      g.moTotal += mo;
      g.eqTotal += eq;
      g.total += mat + mo + eq;
      g.partidas.push(linea);
    }

    const grupos = Array.from(rubros.values());
    const totalGeneral = grupos.reduce((acc, g) => acc + g.total, 0);

    res.json({ grupos, totalGeneral });
  } catch {
    res.status(500).json({ error: "Error al obtener presupuesto" });
  }
});

export default router;

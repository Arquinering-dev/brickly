import { Router } from "express";
import prisma from "../prisma/client";
import { fetchAndStoreLatestICC } from "../services/indices/indec.client";

const router = Router();

// GET /api/indices/icc — últimos 13 meses
router.get("/icc", async (_req, res) => {
  try {
    const raw = await prisma.indiceICC.findMany({
      orderBy: [{ anio: "desc" }, { mes: "desc" }],
      take: 13,
    });
    const indices = raw.map((r) => ({
      ...r,
      variacionMensual: r.variacionMensual !== null ? Number(r.variacionMensual) : null,
      variacionAnual: r.variacionAnual !== null ? Number(r.variacionAnual) : null,
      valorAbsoluto: r.valorAbsoluto !== null ? Number(r.valorAbsoluto) : null,
    }));
    res.json({ indices });
  } catch (err) {
    console.error("[indices] Error al consultar ICC:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// PATCH /api/indices/icc/manual — guardar valorAbsoluto ingresado manualmente
router.patch("/icc/manual", async (req, res) => {
  try {
    const { mes, anio, valorAbsoluto } = req.body as { mes?: number; anio?: number; valorAbsoluto?: number };
    if (!mes || !anio || valorAbsoluto === undefined || isNaN(valorAbsoluto)) {
      return res.status(400).json({ error: "mes, anio y valorAbsoluto son requeridos" });
    }
    const updated = await prisma.indiceICC.upsert({
      where: { mes_anio: { mes, anio } },
      update: { valorAbsoluto, fuente: "manual" },
      create: {
        mes,
        anio,
        valorAbsoluto,
        fuente: "manual",
        fetchedAt: new Date(),
      },
    });
    res.json({
      ok: true,
      indice: {
        ...updated,
        variacionMensual: updated.variacionMensual !== null ? Number(updated.variacionMensual) : null,
        variacionAnual: updated.variacionAnual !== null ? Number(updated.variacionAnual) : null,
        valorAbsoluto: updated.valorAbsoluto !== null ? Number(updated.valorAbsoluto) : null,
      },
    });
  } catch (err) {
    console.error("[indices] Error al guardar valorAbsoluto manual:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/indices/icc/fetch — trigger manual (requiere auth, ya montado con requireAuth)
router.post("/icc/fetch", async (_req, res) => {
  try {
    const result = await fetchAndStoreLatestICC();
    if (!result) {
      return res.status(502).json({ error: "No se pudo obtener el ICC desde ninguna fuente" });
    }
    res.json({
      ok: true,
      indice: {
        ...result,
        variacionMensual: result.variacionMensual !== null ? Number(result.variacionMensual) : null,
        variacionAnual: result.variacionAnual !== null ? Number(result.variacionAnual) : null,
      },
    });
  } catch (err) {
    console.error("[indices] Error al fetchear ICC:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

export default router;

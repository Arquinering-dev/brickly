import { Router, Request, Response } from "express";
import multer from "multer";
import { parseAPUExcel } from "../services/apu-parser.service";
import { importAPU } from "../services/apu-import.service";
import { importPresupuesto } from "../services/presupuesto-import.service";
import { importUnified } from "../services/unified-import.service";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.post("/apu", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No se recibió ningún archivo" });
      return;
    }

    const { data, errors } = parseAPUExcel(req.file.buffer);
    if (!data) {
      res.status(422).json({ errors });
      return;
    }

    const summary = await importAPU(data);
    res.json({ summary, warnings: errors });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error interno" });
  }
});

router.post("/presupuesto", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No se recibió ningún archivo" });
      return;
    }

    const { obraId, cacValor, mesCac } = req.body;
    if (!obraId) {
      res.status(400).json({ error: "obraId es requerido" });
      return;
    }

    const summary = await importPresupuesto({
      obraId,
      cacValor: parseFloat(cacValor) || 0,
      mesCac: mesCac ?? "",
      buffer: req.file.buffer,
    });

    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error interno" });
  }
});

router.post("/unificado", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No se recibió ningún archivo" });
      return;
    }
    const summary = await importUnified(req.file.buffer);
    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error interno" });
  }
});

export default router;

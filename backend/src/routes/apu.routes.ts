import { Router, Request, Response } from "express";
import multer from "multer";
import { parseAPUExcel } from "../services/apu-parser.service";
import { importAPU } from "../services/apu-import.service";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.post("/import", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No se recibió ningún archivo" });
      return;
    }

    const nombre = req.body.nombre || req.file.originalname.replace(/\.xlsx$/i, "");
    const { data, errors } = parseAPUExcel(req.file.buffer);

    if (!data) {
      res.status(422).json({ errors });
      return;
    }

    const summary = await importAPU(nombre, data);
    res.json({ summary, warnings: errors });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    res.status(500).json({ error: message });
  }
});

export default router;

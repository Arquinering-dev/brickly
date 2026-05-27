/**
 * POST /api/import/apu?dry=1   → preview (no escribe en DB)
 * POST /api/import/apu         → importa definitivamente
 *
 * Body: multipart/form-data, campo "file" con el .xlsx
 */
import { Router, Request, Response } from "express";
import multer from "multer";
import { importApuXlsx } from "../services/apu-import.service";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.post(
  "/apu",
  upload.single("file"),
  async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: "Se requiere un archivo .xlsx (campo 'file')" });
      return;
    }

    const dryRun = req.query.dry === "1" || req.query.dry === "true";

    try {
      const result = await importApuXlsx(req.file.buffer, { dryRun });

      if (!dryRun && result.errors.length > 0) {
        res.status(422).json({
          message: "Importación cancelada — errores de validación",
          ...result,
        });
        return;
      }

      res.json({
        message: dryRun
          ? "Preview OK — nada fue guardado"
          : "Importación completada",
        ...result,
      });
    } catch (err) {
      console.error("[import/apu]", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Error al importar el archivo",
      });
    }
  },
);

export default router;

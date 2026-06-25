/**
 * POST /api/import/resumen            → importa el Resumen de Obra a una obra existente
 * POST /api/import/resumen?dry=1      → preview (no escribe en DB)
 *
 * Consume el "Resumen de Obra" de Arquinering (formato v8): presupuesto, composición, ICC y el
 * control financiero (movimientos, subcontratos, quincenas, gastos, certificaciones).
 *
 * Body: multipart/form-data — campo "file" con el .xlsx y "obraId" con la obra destino.
 * El obraId es opcional: si no se envía, la obra se crea/actualiza derivando el código del
 * nombre de archivo (compatibilidad). El flujo recomendado es crear la obra primero y pasar su id.
 */
import { Router, Request, Response } from "express";
import multer from "multer";
import { importResumenXlsx } from "../services/resumen-import.service";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.post(
  "/resumen",
  upload.single("file"),
  async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: "Se requiere un archivo .xlsx (campo 'file')" });
      return;
    }

    const dryRun = req.query.dry === "1" || req.query.dry === "true";
    const { obraId } = req.body as { obraId?: string };

    try {
      const result = await importResumenXlsx(req.file.buffer, {
        dryRun,
        filename: req.file.originalname,
        obraId: obraId || undefined,
      });

      if (!dryRun && result.errors.length > 0) {
        res.status(422).json({
          message: "Importación cancelada — errores de validación",
          ...result,
        });
        return;
      }

      res.json({
        message: dryRun ? "Preview OK — nada fue guardado" : "Importación completada",
        ...result,
      });
    } catch (err) {
      console.error("[import/resumen]", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Error al importar el archivo",
      });
    }
  },
);

export default router;

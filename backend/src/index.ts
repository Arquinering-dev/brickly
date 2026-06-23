import express from "express";
import cors from "cors";
import partidasRoutes from "./routes/partidas.routes";
import insumosRoutes from "./routes/insumos.routes";
import obrasRoutes from "./routes/obras.routes";
import presupuestosRoutes from "./routes/presupuestos.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import importRoutes from "./routes/import.routes";
import authRoutes from "./routes/auth.routes";
import { requireAuth } from "./middleware/auth.middleware";
import prisma from "./prisma/client";
import indicesRoutes from "./routes/indices.routes";
import { ensureCurrentMonthICC } from "./services/indices/indec.client";

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const isDev = process.env.NODE_ENV !== "production";

// En dev Vite puede servir en 5173, 5174… y el browser puede usar localhost o 127.0.0.1.
function isLocalDevOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      if (isDev && isLocalDevOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
  })
);
app.use(express.json());

app.get("/api/health", async (_req, res) => {
  const t0 = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "connected", latencyMs: Date.now() - t0 });
  } catch (err) {
    res.status(503).json({ status: "error", db: "unreachable", latencyMs: Date.now() - t0, error: String(err) });
  }
});
app.use("/api/auth", authRoutes);

app.use("/api/partidas", requireAuth, partidasRoutes);
app.use("/api/insumos", requireAuth, insumosRoutes);
app.use("/api/obras", requireAuth, obrasRoutes);
app.use("/api/presupuestos", requireAuth, presupuestosRoutes);
app.use("/api/dashboard", requireAuth, dashboardRoutes);
app.use("/api/import", requireAuth, importRoutes);
app.use("/api/indices", requireAuth, indicesRoutes);

app.listen(PORT, () => {
  console.log(`Groundwork backend corriendo en http://localhost:${PORT}`);
  // Trae el ICC del mes actual si no está en DB (best-effort, no bloquea el arranque).
  ensureCurrentMonthICC().catch((e) =>
    console.warn("[indec] chequeo startup falló:", e instanceof Error ? e.message : e)
  );
});

export default app;

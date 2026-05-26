import express from "express";
import cors from "cors";
import partidasRoutes from "./routes/partidas.routes";
import insumosRoutes from "./routes/insumos.routes";
import obrasRoutes from "./routes/obras.routes";
import presupuestosRoutes from "./routes/presupuestos.routes";
import planificacionRoutes from "./routes/planificacion.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import authRoutes from "./routes/auth.routes";
import { requireAuth } from "./middleware/auth.middleware";
import prisma from "./prisma/client";

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
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
app.use("/api/planificacion", requireAuth, planificacionRoutes);
app.use("/api/dashboard", requireAuth, dashboardRoutes);

app.listen(PORT, () => {
  console.log(`Groundwork backend corriendo en http://localhost:${PORT}`);
});

export default app;

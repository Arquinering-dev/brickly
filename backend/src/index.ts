import express from "express";
import cors from "cors";
import importRoutes from "./routes/import.routes";
import partidasRoutes from "./routes/partidas.routes";
import insumosRoutes from "./routes/insumos.routes";
import obrasRoutes from "./routes/obras.routes";
import authRoutes from "./routes/auth.routes";
import { requireAuth } from "./middleware/auth.middleware";

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

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);

app.use("/api/import", requireAuth, importRoutes);
app.use("/api/partidas", requireAuth, partidasRoutes);
app.use("/api/insumos", requireAuth, insumosRoutes);
app.use("/api/obras", requireAuth, obrasRoutes);

app.listen(PORT, () => {
  console.log(`Groundwork backend corriendo en http://localhost:${PORT}`);
});

export default app;

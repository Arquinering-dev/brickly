import express from "express";
import cors from "cors";
import importRoutes from "./routes/import.routes";
import partidasRoutes from "./routes/partidas.routes";
import insumosRoutes from "./routes/insumos.routes";
import obrasRoutes from "./routes/obras.routes";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.use("/api/import", importRoutes);
app.use("/api/partidas", partidasRoutes);
app.use("/api/insumos", insumosRoutes);
app.use("/api/obras", obrasRoutes);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Groundwork backend corriendo en http://localhost:${PORT}`);
});

export default app;

import express from "express";
import cors from "cors";
import apuRoutes from "./routes/apu.routes";
import partidasRoutes from "./routes/partidas.routes";
import catalogosRoutes from "./routes/catalogos.routes";
import presupuestoRoutes from "./routes/presupuesto.routes";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.use("/api/apu", apuRoutes);
app.use("/api/partidas", partidasRoutes);
app.use("/api", catalogosRoutes);
app.use("/api/presupuesto", presupuestoRoutes);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Brickly backend corriendo en http://localhost:${PORT}`);
});

export default app;

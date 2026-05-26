import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Sidebar } from "./components/Sidebar";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ObrasListPage from "./pages/ObrasListPage";
import ObraDetailPage from "./pages/ObraDetailPage";
import PartidasPage from "./pages/PartidasPage";
import PartidaDetailPage from "./pages/PartidaDetailPage";
import CatalogosPage from "./pages/CatalogosPage";
import PresupuestoPage from "./pages/PresupuestoPage";
import PlanificacionPage from "./pages/PlanificacionPage";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Layout() {
  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/obras" element={<ObrasListPage />} />
          <Route path="/obras/:id" element={<ObraDetailPage />} />
          <Route path="/obras/:id/:tab" element={<ObraDetailPage />} />

          {/* Catálogo */}
          <Route path="/catalogo" element={<Navigate to="/catalogo/partidas" replace />} />
          <Route path="/catalogo/partidas" element={<PartidasPage />} />
          <Route path="/catalogo/partidas/:id" element={<PartidaDetailPage />} />
          <Route path="/catalogo/insumos" element={<CatalogosPage />} />
          <Route path="/catalogo/presupuestos" element={<PresupuestoPage />} />
          <Route path="/catalogo/presupuestos/nuevo" element={<PresupuestoPage />} />
          <Route path="/catalogo/presupuestos/:id" element={<PresupuestoPage />} />
          <Route path="/catalogo/planificaciones" element={<PlanificacionPage />} />
          <Route path="/catalogo/planificaciones/nueva" element={<PlanificacionPage />} />
          <Route path="/catalogo/planificaciones/:id" element={<PlanificacionPage />} />

          {/* Aliases legacy */}
          <Route path="/partidas" element={<Navigate to="/catalogo/partidas" replace />} />
          <Route path="/partidas/:id" element={<LegacyPartida />} />
          <Route path="/catalogos" element={<Navigate to="/catalogo/insumos" replace />} />
          <Route path="/presupuesto" element={<Navigate to="/catalogo/presupuestos" replace />} />
          <Route path="/presupuesto/nuevo" element={<Navigate to="/catalogo/presupuestos/nuevo" replace />} />
          <Route path="/presupuesto/:id" element={<LegacyPpto />} />
          <Route path="/planificacion" element={<Navigate to="/catalogo/planificaciones" replace />} />
          <Route path="/planificacion/nueva" element={<Navigate to="/catalogo/planificaciones/nueva" replace />} />
          <Route path="/planificacion/:id" element={<LegacyPlan />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

// Tiny redirect components for routes with params
function LegacyPartida() {
  const path = window.location.pathname.replace("/partidas/", "/catalogo/partidas/");
  return <Navigate to={path} replace />;
}
function LegacyPpto() {
  const path = window.location.pathname.replace("/presupuesto/", "/catalogo/presupuestos/");
  return <Navigate to={path} replace />;
}
function LegacyPlan() {
  const path = window.location.pathname.replace("/planificacion/", "/catalogo/planificaciones/");
  return <Navigate to={path} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <TooltipProvider delayDuration={200}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/*"
              element={
                <RequireAuth>
                  <Layout />
                </RequireAuth>
              }
            />
          </Routes>
        </BrowserRouter>
        <Toaster richColors position="bottom-right" />
      </TooltipProvider>
    </AuthProvider>
  );
}

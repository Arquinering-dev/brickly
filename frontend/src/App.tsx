import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import ImportPage from "./pages/ImportPage";
import PartidasPage from "./pages/PartidasPage";
import PartidaDetailPage from "./pages/PartidaDetailPage";
import CatalogosPage from "./pages/CatalogosPage";
import PresupuestoPage from "./pages/PresupuestoPage";

function Sidebar() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? "bg-brand-500 text-white"
        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
    }`;

  return (
    <aside className="w-56 shrink-0 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
      <div className="px-4 py-5 border-b border-gray-100">
        <span className="text-xl font-bold text-brand-600 tracking-tight">🧱 Brickly</span>
        <p className="text-xs text-gray-400 mt-0.5">Control de Obra</p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        <NavLink to="/import" className={linkClass}>
          <span>⬆️</span> Importar APU
        </NavLink>
        <NavLink to="/partidas" className={linkClass}>
          <span>📋</span> Partidas
        </NavLink>
        <NavLink to="/presupuesto" className={linkClass}>
          <span>💰</span> Presupuesto
        </NavLink>
        <NavLink to="/catalogos" className={linkClass}>
          <span>📦</span> Catálogos
        </NavLink>
      </nav>
      <div className="px-4 py-3 text-xs text-gray-300 border-t border-gray-100">
        Arquinering S.R.L.
      </div>
    </aside>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/import" replace />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/partidas" element={<PartidasPage />} />
            <Route path="/partidas/:id" element={<PartidaDetailPage />} />
            <Route path="/catalogos" element={<CatalogosPage />} />
            <Route path="/presupuesto" element={<PresupuestoPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

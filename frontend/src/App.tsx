import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import ImportPage from "./pages/ImportPage";
import PartidasPage from "./pages/PartidasPage";
import PartidaDetailPage from "./pages/PartidaDetailPage";
import CatalogosPage from "./pages/CatalogosPage";
import PresupuestoPage from "./pages/PresupuestoPage";
import PlanificacionPage from "./pages/PlanificacionPage";

function ArquineringLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M30 4 H92 Q96 4 96 8 V92 Q96 96 92 96 H8 Q4 96 4 92 V30 Q4 14 30 4Z" fill="#3d7c38" />
      <text x="50" y="44" textAnchor="middle" fill="white" fontSize="28" fontFamily="Georgia, serif" fontWeight="400" fontStyle="italic" letterSpacing="1">arq</text>
      <text x="50" y="80" textAnchor="middle" fill="white" fontSize="32" fontFamily="Arial, sans-serif" fontWeight="800" letterSpacing="2">ING</text>
    </svg>
  );
}

function Sidebar() {
  const { usuario, logout } = useAuth();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive ? "bg-brand-500 text-white shadow-sm" : "text-gray-600 hover:bg-brand-50 hover:text-brand-700"
    }`;
  const iconClass = (isActive: boolean) => `w-4 h-4 ${isActive ? "text-white" : "text-brand-400"}`;

  return (
    <aside className="w-60 shrink-0 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <ArquineringLogo size={44} />
          <div>
            <p className="text-sm font-bold text-gray-800 leading-tight">Groundwork</p>
            <p className="text-[11px] text-gray-400 leading-tight">Control de Obra</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        <NavLink to="/import" className={linkClass}>
          {({ isActive }) => (
            <>
              <svg className={iconClass(isActive)} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              Importar
            </>
          )}
        </NavLink>
        <NavLink to="/partidas" className={linkClass}>
          {({ isActive }) => (
            <>
              <svg className={iconClass(isActive)} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
              Partidas
            </>
          )}
        </NavLink>
        <NavLink to="/presupuesto" className={linkClass}>
          {({ isActive }) => (
            <>
              <svg className={iconClass(isActive)} viewBox="0 0 20 20" fill="currentColor">
                <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
              </svg>
              Presupuesto
            </>
          )}
        </NavLink>
        <NavLink to="/planificacion" className={linkClass}>
          {({ isActive }) => (
            <>
              <svg className={iconClass(isActive)} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
              Planificación
            </>
          )}
        </NavLink>
        <NavLink to="/catalogos" className={linkClass}>
          {({ isActive }) => (
            <>
              <svg className={iconClass(isActive)} viewBox="0 0 20 20" fill="currentColor">
                <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
              </svg>
              Catálogos
            </>
          )}
        </NavLink>
      </nav>

      <div className="px-4 py-3 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <ArquineringLogo size={20} />
            <span className="text-[11px] text-gray-500 truncate">
              {usuario?.nombre ?? usuario?.email ?? ""}
            </span>
          </div>
          <button
            onClick={logout}
            title="Cerrar sesión"
            className="text-gray-400 hover:text-gray-600 transition-colors ml-2 shrink-0"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h7a1 1 0 100-2H4V5h6a1 1 0 100-2H3zm11.707 4.293a1 1 0 010 1.414L13.414 10l1.293 1.293a1 1 0 01-1.414 1.414l-2-2a1 1 0 010-1.414l2-2a1 1 0 011.414 0z" clipRule="evenodd" />
              <path d="M13 10a1 1 0 011-1h3a1 1 0 110 2h-3a1 1 0 01-1-1z" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Layout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/import" replace />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/partidas" element={<PartidasPage />} />
          <Route path="/partidas/:id" element={<PartidaDetailPage />} />
          <Route path="/catalogos" element={<CatalogosPage />} />
          <Route path="/presupuesto" element={<PresupuestoPage />} />
          <Route path="/planificacion" element={<PlanificacionPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
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
    </AuthProvider>
  );
}

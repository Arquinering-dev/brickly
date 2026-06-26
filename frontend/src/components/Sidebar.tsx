import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Building2, Package, LogOut,
  ChevronDown, FileText, Upload, Boxes, ClipboardCheck, Menu, X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { cn } from "../lib/cn";

function ArquineringLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="brandGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E87C1E" />
          <stop offset="100%" stopColor="#C96415" />
        </linearGradient>
      </defs>
      <path d="M30 4 H92 Q96 4 96 8 V92 Q96 96 92 96 H8 Q4 96 4 92 V30 Q4 14 30 4Z" fill="url(#brandGrad)" />
      <text x="50" y="44" textAnchor="middle" fill="white" fontSize="28" fontFamily="Georgia, serif" fontWeight="400" fontStyle="italic" letterSpacing="1">arq</text>
      <text x="50" y="80" textAnchor="middle" fill="white" fontSize="32" fontFamily="Arial, sans-serif" fontWeight="800" letterSpacing="2">ING</text>
    </svg>
  );
}

interface NavItemProps {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  end?: boolean;
  onNavigate?: () => void;
}

function NavItem({ to, icon: Icon, label, end, onNavigate }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) => cn(
        "group flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-all duration-150",
        isActive
          ? "bg-white/10 text-white border-l-2 border-accent-400 pl-[10px]"
          : "text-brand-100/75 hover:bg-white/10 hover:text-white border-l-2 border-transparent pl-[10px]"
      )}
    >
      {({ isActive }) => (
        <>
          <Icon className={cn("h-[18px] w-[18px] shrink-0 transition-colors",
            isActive ? "text-accent-300" : "text-brand-200/50 group-hover:text-brand-100"
          )} />
          {label}
        </>
      )}
    </NavLink>
  );
}

function NavGroup({ label, children, defaultOpen = true }: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-2xs font-semibold text-brand-200/40 uppercase tracking-wider hover:text-brand-100/60 transition-colors"
      >
        <span>{label}</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform", !open && "-rotate-90")} />
      </button>
      {open && <div className="space-y-0.5 mt-0.5">{children}</div>}
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { usuario, logout } = useAuth();
  const location = useLocation();
  const inCatalogo = location.pathname.startsWith("/catalogo");

  return (
    <>
      <div className="px-5 py-5 border-b border-brand-800/60">
        <div className="flex items-center gap-3">
          <ArquineringLogo size={38} />
          <div>
            <p className="text-sm font-bold text-white leading-tight font-display">Groundwork</p>
            <p className="text-2xs text-brand-200/60 leading-tight">Arquinering · Control de Obra</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        <NavGroup label="Principal" defaultOpen>
          <NavItem to="/" icon={LayoutDashboard} label="Dashboard" end onNavigate={onNavigate} />
          <NavItem to="/obras" icon={Building2} label="Obras" onNavigate={onNavigate} />
          <NavItem to="/avance" icon={ClipboardCheck} label="Avance de obra" onNavigate={onNavigate} />
          <NavItem to="/proyeccion" icon={Boxes} label="Proyección de insumos" onNavigate={onNavigate} />
        </NavGroup>

        <NavGroup label="Catálogo" defaultOpen={inCatalogo}>
          <NavItem to="/catalogo/partidas" icon={FileText} label="Partidas APU" onNavigate={onNavigate} />
          <NavItem to="/catalogo/insumos" icon={Package} label="Insumos" onNavigate={onNavigate} />
          <NavItem to="/catalogo/importar" icon={Upload} label="Importar Resumen" onNavigate={onNavigate} />
        </NavGroup>
      </nav>

      <div className="px-3 py-3 border-t border-brand-800/60">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-accent-400 to-accent-600 grid place-items-center text-white text-2xs font-bold shrink-0">
              {(usuario?.nombre ?? usuario?.email ?? "U").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-brand-100 truncate">
                {usuario?.nombre ?? usuario?.email?.split("@")[0] ?? ""}
              </p>
              <p className="text-2xs text-brand-200/50 truncate">{usuario?.email ?? ""}</p>
            </div>
          </div>
          <button
            onClick={logout}
            title="Cerrar sesión"
            className="text-brand-200/50 hover:text-white hover:bg-white/10 p-1.5 rounded transition-colors ml-2 shrink-0"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Top bar móvil */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 h-14 bg-brand-700 border-b border-brand-800/60 flex items-center gap-3 px-4">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 -ml-1.5 rounded text-brand-100/70 hover:bg-white/10 hover:text-white active:bg-white/20"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>
        <ArquineringLogo size={28} />
        <span className="text-sm font-bold text-white font-display">Groundwork</span>
      </div>

      {/* Drawer móvil */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 max-w-[85%] bg-brand-700 flex flex-col shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-3 p-1.5 rounded text-brand-200/60 hover:bg-white/10 hover:text-white z-10"
              aria-label="Cerrar menú"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Sidebar escritorio */}
      <aside className="hidden md:flex w-64 shrink-0 bg-brand-700 flex-col h-screen sticky top-0">
        <SidebarContent />
      </aside>
    </>
  );
}

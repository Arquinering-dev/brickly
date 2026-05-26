import { useState, useEffect } from "react";
import { Search, Package, HardHat, Wrench, FileText } from "lucide-react";
import { apiFetch } from "../lib/api";
import { fmtMoney } from "../lib/format";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty";
import { Paginador } from "../components/Paginador";
import { cn } from "../lib/cn";

const PER_PAGE = 25;

interface Insumo {
  id: string;
  codigo: string;
  descripcion: string;
  tipo: "MATERIAL" | "MANO_DE_OBRA" | "EQUIPO" | "SUBCONTRATO";
  unidad: string;
  precioReferencia: number;
  proveedor?: string;
  categoria?: string;
}

type Tab = "MATERIAL" | "MANO_DE_OBRA" | "EQUIPO" | "SUBCONTRATO";

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "MATERIAL", label: "Materiales", icon: Package },
  { key: "MANO_DE_OBRA", label: "Mano de Obra", icon: HardHat },
  { key: "EQUIPO", label: "Equipos", icon: Wrench },
  { key: "SUBCONTRATO", label: "Subcontratos", icon: FileText },
];

export default function CatalogosPage() {
  const [tab, setTab] = useState<Tab>("MATERIAL");
  const [search, setSearch] = useState("");
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [counts, setCounts] = useState<Partial<Record<Tab, number>>>({});
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [tab, search]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ tipo: tab });
    if (search) params.set("search", search);
    apiFetch(`/api/insumos?${params}`)
      .then((r) => r.json())
      .then((data: Insumo[]) => {
        setInsumos(data);
        setCounts((prev) => ({ ...prev, [tab]: data.length }));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tab, search]);

  const paginados = insumos.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-stone-900 tracking-tight">Insumos</h1>
        <p className="text-sm text-stone-500 mt-1">Catálogo maestro: materiales, mano de obra, equipos y subcontratos</p>
      </div>

      {/* Tabs como pills */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => {
          const active = tab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border",
                active
                  ? "bg-brand-700 text-white border-brand-700 shadow-sm"
                  : "bg-white text-stone-600 border-stone-200 hover:border-stone-300 hover:bg-stone-50"
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
              {(counts[t.key] ?? 0) > 0 && (
                <span className={cn(
                  "text-2xs px-1.5 py-0.5 rounded-md",
                  active ? "bg-white/20 text-white" : "bg-stone-100 text-stone-500"
                )}>
                  {counts[t.key]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
        <Input
          placeholder="Buscar por código o descripción…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
        </div>
      ) : insumos.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Sin insumos"
          description="No hay insumos cargados de este tipo. Corré el seed APU para poblar el catálogo."
        />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="text-left px-4 py-3 font-medium text-stone-500 text-2xs uppercase tracking-wider">Código</th>
                <th className="text-left px-4 py-3 font-medium text-stone-500 text-2xs uppercase tracking-wider">Descripción</th>
                <th className="text-left px-4 py-3 font-medium text-stone-500 text-2xs uppercase tracking-wider">Unidad</th>
                <th className="text-right px-4 py-3 font-medium text-stone-500 text-2xs uppercase tracking-wider">Precio ref.</th>
                {(tab === "MATERIAL" || tab === "SUBCONTRATO") && (
                  <th className="text-left px-4 py-3 font-medium text-stone-500 text-2xs uppercase tracking-wider">Proveedor</th>
                )}
                <th className="text-left px-4 py-3 font-medium text-stone-500 text-2xs uppercase tracking-wider">Categoría</th>
              </tr>
            </thead>
            <tbody>
              {paginados.map((ins) => (
                <tr key={ins.id} className="border-b border-stone-50 hover:bg-stone-50/50 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs text-stone-500">{ins.codigo}</td>
                  <td className="px-4 py-2.5 text-stone-800 font-medium">{ins.descripcion}</td>
                  <td className="px-4 py-2.5 text-stone-500 text-xs">{ins.unidad}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-stone-900 stat-number">
                    {fmtMoney(ins.precioReferencia)}
                  </td>
                  {(tab === "MATERIAL" || tab === "SUBCONTRATO") && (
                    <td className="px-4 py-2.5 text-stone-500 text-xs">{ins.proveedor ?? "—"}</td>
                  )}
                  <td className="px-4 py-2.5">
                    {ins.categoria ? <Badge>{ins.categoria}</Badge> : <span className="text-stone-300 text-xs">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Paginador total={insumos.length} page={page} perPage={PER_PAGE} onChange={setPage} />
        </Card>
      )}
    </div>
  );
}

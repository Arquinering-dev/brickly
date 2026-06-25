import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Plus, Search, AlertTriangle } from "lucide-react";
import { apiFetch } from "../lib/api";
import { fmtMoney, fmtPct, fmtDate } from "../lib/format";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { EmptyState } from "../components/ui/empty";
import { Skeleton } from "../components/ui/skeleton";
import { NuevaObraDialog } from "../components/NuevaObraDialog";

interface ObraResumen {
  id: string;
  nombre: string;
  codigo: string;
  estado: "EN_PRESUPUESTO" | "EN_CURSO" | "FINALIZADA";
  totalCD: number;
  totalPV: number;
  pctAvance: number;
  tareasCount: number;
  rubrosCount: number;
  fechaInicio: string | null;
  duracionMeses: number;
  alertas: string[];
  tienePresupuesto: boolean;
  tieneAprobado: boolean;
  tieneCronograma: boolean;
}

export default function ObrasListPage() {
  const navigate = useNavigate();
  const [obras, setObras] = useState<ObraResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState<"" | "EN_PRESUPUESTO" | "EN_CURSO" | "FINALIZADA">("");
  const [nuevaOpen, setNuevaOpen] = useState(false);

  useEffect(() => {
    apiFetch("/api/dashboard")
      .then((r) => r.json())
      .then((d: { obras: ObraResumen[] }) => { setObras(d.obras); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtradas = obras.filter((o) => {
    if (estado && o.estado !== estado) return false;
    if (search && !`${o.nombre} ${o.codigo}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const estadoCount = {
    EN_PRESUPUESTO: obras.filter((o) => o.estado === "EN_PRESUPUESTO").length,
    EN_CURSO: obras.filter((o) => o.estado === "EN_CURSO").length,
    FINALIZADA: obras.filter((o) => o.estado === "FINALIZADA").length,
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight">Obras</h1>
          <p className="text-sm text-stone-500 mt-1">{obras.length} obras en cartera</p>
        </div>
        <Button onClick={() => setNuevaOpen(true)}>
          <Plus /> Nueva obra
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <Input
            placeholder="Buscar por nombre o código…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg bg-stone-100 border border-stone-200">
          {[
            { v: "" as const, label: `Todas (${obras.length})` },
            { v: "EN_CURSO" as const, label: `En curso (${estadoCount.EN_CURSO})` },
            { v: "EN_PRESUPUESTO" as const, label: `Presupuesto (${estadoCount.EN_PRESUPUESTO})` },
            { v: "FINALIZADA" as const, label: `Finalizadas (${estadoCount.FINALIZADA})` },
          ].map((f) => (
            <button
              key={f.v || "all"}
              onClick={() => setEstado(f.v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                estado === f.v ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
        </div>
      ) : filtradas.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={obras.length === 0 ? "No hay obras todavía" : "Sin resultados"}
          description={obras.length === 0 ? "Empezá creando un presupuesto para tu primera obra." : "Probá con otro filtro o término de búsqueda."}
          action={obras.length === 0 ? (
            <Button onClick={() => setNuevaOpen(true)}>
              <Plus /> Nueva obra
            </Button>
          ) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtradas.map((o) => (
            <ObraRow key={o.id} obra={o} onClick={() => navigate(`/obras/${o.id}`)} />
          ))}
        </div>
      )}

      <NuevaObraDialog
        open={nuevaOpen}
        onOpenChange={setNuevaOpen}
        onCreated={(obra) => navigate(`/catalogo/importar?obra=${obra.id}`)}
      />
    </div>
  );
}

function ObraRow({ obra, onClick }: { obra: ObraResumen; onClick: () => void }) {
  const estadoLabel: Record<string, { label: string; variant: "success" | "warning" | "default" }> = {
    EN_CURSO: { label: "En curso", variant: "success" },
    EN_PRESUPUESTO: { label: "En presupuesto", variant: "warning" },
    FINALIZADA: { label: "Finalizada", variant: "default" },
  };
  const e = estadoLabel[obra.estado] ?? { label: obra.estado, variant: "default" as const };

  return (
    <Card
      onClick={onClick}
      className="p-5 hover:shadow-md hover:border-brand-300 transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="min-w-0">
          <p className="text-2xs uppercase tracking-wider text-stone-400 mb-0.5 font-mono">{obra.codigo}</p>
          <p className="text-base font-bold text-stone-900 truncate group-hover:text-brand-700 transition-colors">{obra.nombre}</p>
        </div>
        <Badge variant={e.variant}>{e.label}</Badge>
      </div>

      {obra.tieneCronograma && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-stone-500">Avance</span>
            <span className="font-bold text-stone-900">{fmtPct(obra.pctAvance)}</span>
          </div>
          <Progress value={obra.pctAvance * 100} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 text-xs">
        <Stat label="Costo directo" value={fmtMoney(obra.totalCD, { compact: true })} />
        <Stat label="Precio venta" value={fmtMoney(obra.totalPV, { compact: true })} />
        <Stat label="Tareas" value={obra.tareasCount.toString()} />
        <Stat label={obra.fechaInicio ? "Inicio" : "Duración"} value={obra.fechaInicio ? fmtDate(obra.fechaInicio, "month") : `${obra.duracionMeses} meses`} />
      </div>

      {obra.alertas.length > 0 && (
        <div className="mt-3 pt-3 border-t border-stone-100 space-y-1">
          {obra.alertas.map((a, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3 text-amber-500" />
              <span className="text-2xs text-amber-700">{a}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-stone-400 mb-0.5">{label}</p>
      <p className="font-semibold text-stone-800 truncate">{value}</p>
    </div>
  );
}

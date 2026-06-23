import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2, Calendar, TrendingUp, AlertTriangle, Activity,
  Wallet, Layers, ChevronRight, Plus, BarChart2, RefreshCw, Pencil, Check, X,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { apiFetch } from "../lib/api";
import { toast } from "sonner";
import { fmtMoney, fmtPct, fmtDate } from "../lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { StatCard } from "../components/ui/stat-card";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { EmptyState } from "../components/ui/empty";
import { Skeleton } from "../components/ui/skeleton";
import { Button } from "../components/ui/button";

interface ObraResumen {
  id: string;
  nombre: string;
  codigo: string;
  estado: "EN_PRESUPUESTO" | "EN_CURSO" | "FINALIZADA";
  tienePresupuesto: boolean;
  tieneAprobado: boolean;
  tieneCronograma: boolean;
  totalCD: number;
  totalPV: number;
  pctAvance: number;
  mesActualOrdinal: number | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  duracionMeses: number;
  tareasCount: number;
  rubrosCount: number;
  alertas: string[];
}

interface IndiceICC {
  id: string;
  mes: number;
  anio: number;
  variacionMensual: number | null;
  variacionAnual: number | null;
  valorAbsoluto: number | null;
  fuente: string;
  fetchedAt: string;
}

interface DashboardData {
  kpis: {
    obrasActivas: number;
    obrasEnPpto: number;
    obrasFinalizadas: number;
    obrasTotal: number;
    totalCarteraPV: number;
    pctAvancePromedio: number;
    facturacionMesProyectada: number;
  };
  obras: ObraResumen[];
  cashflow: { mes: string; fecha: string; total: number; porObra: Record<string, number> }[];
  obrasAtencion: { id: string; nombre: string; codigo: string; estado: string; alertas: string[] }[];
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [icc, setIcc] = useState<IndiceICC[]>([]);
  const [cacBase, setCacBase] = useState<{ valor: number; mes: string } | null>(null);

  useEffect(() => {
    apiFetch("/api/dashboard")
      .then((r) => r.json())
      .then((d: DashboardData) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
    apiFetch("/api/indices/icc")
      .then((r) => r.json())
      .then((d: { indices: IndiceICC[] }) => setIcc(d.indices ?? []))
      .catch(() => {});
    // Traer el cacValor del presupuesto más reciente para mostrar el coeficiente en el widget
    apiFetch("/api/presupuestos")
      .then((r) => r.json())
      .then((list: Array<{ cacValor: number; mesCac: string; fecha: string }>) => {
        const withBase = list.filter((p) => p.cacValor > 0);
        if (withBase.length > 0) {
          withBase.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
          setCacBase({ valor: withBase[0].cacValor, mes: withBase[0].mesCac });
        }
      })
      .catch(() => {});
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (!data) return <div className="p-8 text-stone-500">Error al cargar dashboard</div>;

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight">Panorama general</h1>
          <p className="text-sm text-stone-500 mt-1">
            {data.obras.length} obras en cartera · {fmtDate(new Date(), "long")}
          </p>
        </div>
        <Button onClick={() => navigate("/catalogo/presupuestos/nuevo")} size="md">
          <Plus />
          Nuevo presupuesto
        </Button>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Obras en curso"
          value={data.kpis.obrasActivas}
          hint={`${data.kpis.obrasEnPpto} en presupuesto · ${data.kpis.obrasFinalizadas} finalizadas`}
          icon={Building2}
          variant="brand"
        />
        <StatCard
          label="Cartera total"
          value={fmtMoney(data.kpis.totalCarteraPV, { compact: true })}
          hint="Precio venta acumulado"
          icon={Wallet}
        />
        <StatCard
          label="Facturación del mes"
          value={fmtMoney(data.kpis.facturacionMesProyectada, { compact: true })}
          hint="Proyección según cronograma"
          icon={TrendingUp}
        />
        <StatCard
          label="Avance previsto"
          value={fmtPct(data.kpis.pctAvancePromedio)}
          hint={`Planificado · ${data.obras.length} obras`}
          icon={Activity}
        />
      </div>

      {/* Grid principal: Obras | Cashflow + Atención */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Obras cards */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-stone-900">Obras</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/obras")}>
              Ver todas <ChevronRight />
            </Button>
          </div>

          {data.obras.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No hay obras todavía"
              description="Creá un presupuesto para empezar a gestionar una obra."
              action={
                <Button onClick={() => navigate("/catalogo/presupuestos/nuevo")}>
                  <Plus /> Nuevo presupuesto
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.obras.slice(0, 6).map((o) => (
                <ObraCard key={o.id} obra={o} onClick={() => navigate(`/obras/${o.id}`)} />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar derecha: cashflow + atención */}
        <div className="space-y-4">
          {/* Cashflow */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Cashflow consolidado</CardTitle>
                <Badge variant="brand">{data.cashflow.length} meses</Badge>
              </div>
              <CardDescription>Facturación proyectada por mes (todas las obras)</CardDescription>
            </CardHeader>
            <CardContent className="p-2">
              {data.cashflow.length === 0 ? (
                <p className="text-xs text-stone-400 text-center py-8">Sin cronograma cargado</p>
              ) : (
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.cashflow.slice(0, 18)} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="cf" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2d5d52" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#2d5d52" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                      <XAxis
                        dataKey="mes"
                        tick={{ fontSize: 10, fill: "#78716c" }}
                        tickFormatter={(m: string) => {
                          const d = new Date(m + "-01");
                          return d.toLocaleDateString("es-AR", { month: "short" });
                        }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "#78716c" }}
                        tickFormatter={(v: number) =>
                          v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                        }
                        axisLine={false}
                        tickLine={false}
                      />
                      <ReTooltip
                        contentStyle={{ borderRadius: 8, border: "1px solid #e7e5e4", fontSize: 12 }}
                        formatter={(v) => fmtMoney(Number(v), { compact: true })}
                        labelFormatter={(m) => fmtDate(new Date(String(m) + "-01"), "month")}
                      />
                      <Area type="monotone" dataKey="total" stroke="#2d5d52" strokeWidth={2} fill="url(#cf)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ICC INDEC */}
          <ICCWidget indices={icc} cacBase={cacBase} />

          {/* Necesita atención */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <CardTitle>Necesita atención</CardTitle>
              </div>
              <CardDescription>{data.obrasAtencion.length} obras con alertas</CardDescription>
            </CardHeader>
            <CardContent className="p-3">
              {data.obrasAtencion.length === 0 ? (
                <p className="text-xs text-stone-400 text-center py-4">Todo en orden ✓</p>
              ) : (
                <ul className="space-y-1">
                  {data.obrasAtencion.slice(0, 5).map((o) => (
                    <li key={o.id}>
                      <button
                        onClick={() => navigate(`/obras/${o.id}`)}
                        className="w-full flex items-start gap-3 p-2 rounded-md hover:bg-stone-50 transition-colors text-left"
                      >
                        <div className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-2 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-stone-800 truncate">{o.nombre}</p>
                          <p className="text-2xs text-stone-500 truncate">
                            {o.alertas.join(" · ")}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ObraCard({ obra, onClick }: { obra: ObraResumen; onClick: () => void }) {
  const estadoLabel: Record<string, { label: string; variant: "success" | "warning" | "default" }> = {
    EN_CURSO: { label: "En curso", variant: "success" },
    EN_PRESUPUESTO: { label: "En presupuesto", variant: "warning" },
    FINALIZADA: { label: "Finalizada", variant: "default" },
  };
  const e = estadoLabel[obra.estado] ?? { label: obra.estado, variant: "default" as const };

  return (
    <button
      onClick={onClick}
      className="text-left bg-white border border-stone-200/70 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-brand-300 transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <p className="text-2xs uppercase tracking-wider text-stone-400 mb-0.5">{obra.codigo}</p>
          <p className="text-base font-bold text-stone-900 truncate">{obra.nombre}</p>
        </div>
        <Badge variant={e.variant}>{e.label}</Badge>
      </div>

      {obra.tieneCronograma && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-stone-500">Avance previsto</span>
            <span className="font-bold text-stone-900">{fmtPct(obra.pctAvance)}</span>
          </div>
          <Progress value={obra.pctAvance * 100} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-stone-400 mb-0.5">Precio venta</p>
          <p className="font-bold text-stone-800">{fmtMoney(obra.totalPV, { compact: true })}</p>
        </div>
        <div>
          <p className="text-stone-400 mb-0.5">Tareas</p>
          <p className="font-semibold text-stone-700 flex items-center gap-1">
            <Layers className="h-3 w-3 text-stone-400" />{obra.tareasCount}
          </p>
        </div>
        {obra.fechaInicio && (
          <div>
            <p className="text-stone-400 mb-0.5">Inicio</p>
            <p className="font-semibold text-stone-700 flex items-center gap-1">
              <Calendar className="h-3 w-3 text-stone-400" />
              {fmtDate(obra.fechaInicio, "month")}
            </p>
          </div>
        )}
        {obra.duracionMeses > 0 && (
          <div>
            <p className="text-stone-400 mb-0.5">Duración</p>
            <p className="font-semibold text-stone-700">{obra.duracionMeses} meses</p>
          </div>
        )}
      </div>

      {obra.alertas.length > 0 && (
        <div className="mt-3 pt-3 border-t border-stone-100 flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3 text-amber-500" />
          <span className="text-2xs text-amber-700 truncate">{obra.alertas[0]}</span>
        </div>
      )}
    </button>
  );
}

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function ICCWidget({ indices: initialIndices, cacBase }: { indices: IndiceICC[]; cacBase: { valor: number; mes: string } | null }) {
  const [indices, setIndices] = useState<IndiceICC[]>(initialIndices);
  const [fetching, setFetching] = useState(false);
  const [editingAbsoluto, setEditingAbsoluto] = useState(false);
  const [absolutoDraft, setAbsolutoDraft] = useState("");
  const [savingAbsoluto, setSavingAbsoluto] = useState(false);

  // Sync if parent refreshes the initial data (first load)
  useEffect(() => { setIndices(initialIndices); }, [initialIndices]);

  async function handleRefresh() {
    setFetching(true);
    const tid = toast.loading("Consultando INDEC…");
    try {
      const res = await apiFetch("/api/indices/icc/fetch", { method: "POST" });
      const data = await res.json() as { ok?: boolean; indice?: IndiceICC; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Error al actualizar");
      setIndices((prev) => {
        const filtered = prev.filter((i) => !(i.mes === data.indice!.mes && i.anio === data.indice!.anio));
        return [...filtered, data.indice!];
      });
      const { mes, anio, variacionMensual } = data.indice!;
      const mesStr = MESES[mes - 1];
      const varStr = variacionMensual !== null ? ` · +${variacionMensual.toFixed(1)}% mensual` : "";
      toast.success(`ICC actualizado — ${mesStr} ${anio}${varStr}`, { id: tid });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      toast.error(`No se pudo actualizar: ${msg}`, { id: tid });
    } finally {
      setFetching(false);
    }
  }

  async function handleSaveAbsoluto() {
    if (!latest) return;
    const val = parseFloat(absolutoDraft.replace(/\./g, "").replace(",", "."));
    if (isNaN(val) || val <= 0) {
      toast.error("Valor inválido — ingresá el nivel ICC (ej: 16.000)");
      return;
    }
    setSavingAbsoluto(true);
    try {
      const res = await apiFetch("/api/indices/icc/manual", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes: latest.mes, anio: latest.anio, valorAbsoluto: val }),
      });
      const data = await res.json() as { ok?: boolean; indice?: IndiceICC; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Error al guardar");
      setIndices((prev) => {
        const filtered = prev.filter((i) => !(i.mes === data.indice!.mes && i.anio === data.indice!.anio));
        return [...filtered, data.indice!];
      });
      setEditingAbsoluto(false);
      setAbsolutoDraft("");
      toast.success(`ICC absoluto guardado — ${MESES[latest.mes - 1]} ${latest.anio}: ${val.toLocaleString("es-AR")}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSavingAbsoluto(false);
    }
  }

  const sorted = [...indices].sort((a, b) => a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes);
  const latest = sorted[sorted.length - 1];
  const prev6 = sorted.slice(-6);
  const coefICC = cacBase?.valor && latest?.valorAbsoluto
    ? latest.valorAbsoluto / cacBase.valor
    : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-stone-400" />
            <CardTitle>ICC · INDEC</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {latest && <span className="text-2xs text-stone-400 font-medium">{MESES[latest.mes - 1]} {latest.anio}</span>}
            <button
              onClick={handleRefresh}
              disabled={fetching}
              title="Actualizar desde INDEC"
              className="rounded-md p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${fetching ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
        <CardDescription>Índice del Costo de la Construcción</CardDescription>
      </CardHeader>
      <CardContent className="p-3 pt-1 space-y-3">
        {!latest ? (
          <div className="py-4 text-center space-y-2">
            <p className="text-xs text-stone-400">Sin datos disponibles</p>
            <button onClick={handleRefresh} disabled={fetching} className="text-xs text-brand-600 hover:underline disabled:opacity-40">
              {fetching ? "Buscando…" : "Traer ahora"}
            </button>
          </div>
        ) : (
          <>
            {/* Coeficiente acumulado desde presupuesto base */}
            {coefICC !== null ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold">Coeficiente desde {cacBase?.mes}</p>
                  <span className="text-sm font-black text-amber-700">×{coefICC.toFixed(3)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-amber-600">
                    ICC base: {cacBase!.valor.toLocaleString("es-AR")} → actual: {latest.valorAbsoluto!.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                  </p>
                  <button
                    onClick={() => { setEditingAbsoluto(true); setAbsolutoDraft(String(latest.valorAbsoluto)); }}
                    className="text-amber-500 hover:text-amber-700 ml-2 shrink-0"
                    title="Editar valor absoluto"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-2.5">
                {cacBase && !latest?.valorAbsoluto && (
                  <p className="text-[10px] text-stone-500 mb-1.5">
                    Coeficiente: falta el nivel ICC de {MESES[(latest?.mes ?? 1) - 1]} {latest?.anio}
                  </p>
                )}
                {editingAbsoluto ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={absolutoDraft}
                      onChange={(e) => setAbsolutoDraft(e.target.value)}
                      placeholder="Ej: 16000"
                      className="flex-1 text-xs border border-stone-300 rounded px-2 py-1 focus:outline-none focus:border-amber-400"
                      onKeyDown={(e) => { if (e.key === "Enter") handleSaveAbsoluto(); if (e.key === "Escape") setEditingAbsoluto(false); }}
                      autoFocus
                    />
                    <button onClick={handleSaveAbsoluto} disabled={savingAbsoluto} className="text-emerald-600 hover:text-emerald-700 disabled:opacity-40">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setEditingAbsoluto(false)} className="text-stone-400 hover:text-stone-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : latest?.valorAbsoluto ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-stone-400">Nivel ICC {MESES[(latest.mes ?? 1) - 1]} {latest.anio}</p>
                      <p className="text-sm font-bold text-stone-700">{latest.valorAbsoluto.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</p>
                    </div>
                    <button
                      onClick={() => { setEditingAbsoluto(true); setAbsolutoDraft(String(latest.valorAbsoluto)); }}
                      className="text-stone-400 hover:text-stone-600"
                      title="Editar valor absoluto"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingAbsoluto(true)}
                    className="text-xs text-amber-600 hover:text-amber-700 hover:underline flex items-center gap-1"
                  >
                    <Pencil className="h-3 w-3" /> Ingresar nivel ICC {MESES[(latest?.mes ?? 1) - 1]} {latest?.anio}
                  </button>
                )}
              </div>
            )}

            {/* Variación mensual */}
            <div className="flex items-end gap-3">
              <div>
                <p className="text-2xs uppercase tracking-wider text-stone-400 mb-0.5">Var. mensual</p>
                <p className={`text-2xl font-black ${latest.variacionMensual === null ? "text-stone-400" : latest.variacionMensual >= 0 ? "text-amber-600" : "text-emerald-600"}`}>
                  {latest.variacionMensual !== null ? `${latest.variacionMensual >= 0 ? "+" : ""}${latest.variacionMensual.toFixed(1)}%` : "—"}
                </p>
              </div>
              {latest.variacionAnual !== null && (
                <div className="pb-0.5">
                  <p className="text-2xs uppercase tracking-wider text-stone-400 mb-0.5">Interanual</p>
                  <p className="text-sm font-bold text-stone-600">+{latest.variacionAnual.toFixed(1)}%</p>
                </div>
              )}
            </div>

            {/* Mini histograma últimos meses */}
            {prev6.length > 1 && (
              <div>
                <p className="text-2xs text-stone-400 mb-1.5">Últimos {prev6.length} meses</p>
                <div className="flex items-end gap-1 h-10">
                  {prev6.map((idx) => {
                    const v = idx.variacionMensual ?? 0;
                    const maxV = Math.max(...prev6.map((x) => x.variacionMensual ?? 0));
                    const pct = maxV > 0 ? (v / maxV) * 100 : 50;
                    const isLatest = idx.mes === latest.mes && idx.anio === latest.anio;
                    return (
                      <div key={`${idx.mes}-${idx.anio}`} className="flex-1 flex flex-col items-center gap-0.5">
                        <div
                          className={`w-full rounded-sm transition-all ${isLatest ? "bg-amber-500" : "bg-stone-200"}`}
                          style={{ height: `${Math.max(pct, 8)}%` }}
                        />
                        <span className="text-[9px] text-stone-400">{MESES[idx.mes - 1]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="text-[10px] text-stone-400 border-t border-stone-100 pt-2">
              {latest.fuente === "argly" ? "INDEC vía Argly" : latest.fuente === "manual" ? "Ingresado manualmente" : "FTP INDEC"}
              {" · "}actualizado {new Date(latest.fetchedAt).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 grid grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
        </div>
        <div className="space-y-4">
          <Skeleton className="h-60 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Building2, Calendar, TrendingUp, Layers, AlertTriangle,
  Calculator, BarChart3, History, Upload, Sparkles, FileSpreadsheet,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { apiFetch } from "../lib/api";
import { fmtMoney, fmtPct, fmtDate } from "../lib/format";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty";
import { Button } from "../components/ui/button";

interface Obra {
  id: string;
  nombre: string;
  codigo: string;
  estado: "EN_PRESUPUESTO" | "EN_CURSO" | "FINALIZADA";
}

interface Presupuesto {
  id: string;
  tipo: "GENERADOR" | "APROBADO";
  nombre: string | null;
  version: string | null;
  totalCD: number;
  totalPV: number;
  lineasCount: number;
  rubrosCount: number;
  fechaInicio: string | null;
  estado: string;
}

interface Cronograma {
  rubros: { nombre: string; totalRubro: number; pctEsperadoAhoy: number; estado: string }[];
  meses: { mesOrdinal: number; fecha: string; etiqueta: string }[];
  kpi: { totalGlobal: number; avanceMontoGlobal: number; pctAcumulado: number } | null;
  cronogramaCargado: boolean;
}

export default function ObraDetailPage() {
  const { id, tab } = useParams<{ id: string; tab?: string }>();
  const navigate = useNavigate();
  const [obra, setObra] = useState<Obra | null>(null);
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [cronograma, setCronograma] = useState<Cronograma | null>(null);
  const [loading, setLoading] = useState(true);

  const currentTab = tab ?? "resumen";

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      apiFetch(`/api/obras`).then((r) => r.json()),
      apiFetch(`/api/presupuestos?obraId=${id}`).then((r) => r.json()),
      apiFetch(`/api/obras/${id}/cronograma`).then((r) => r.json()).catch(() => null),
    ]).then(([obras, ppto, cron]) => {
      setObra((obras as Obra[]).find((o) => o.id === id) ?? null);
      setPresupuestos(ppto as Presupuesto[]);
      setCronograma(cron as Cronograma | null);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="p-8 max-w-[1600px] mx-auto space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[0,1,2,3].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (!obra) {
    return (
      <div className="p-8">
        <EmptyState
          icon={Building2}
          title="Obra no encontrada"
          action={<Button variant="outline" onClick={() => navigate("/obras")}>Volver a obras</Button>}
        />
      </div>
    );
  }

  const aprobado = presupuestos.find((p) => p.tipo === "APROBADO");
  const generador = presupuestos.find((p) => p.tipo === "GENERADOR");
  const headerPpal = aprobado ?? generador;

  const estadoLabel: Record<string, { label: string; variant: "success" | "warning" | "default" }> = {
    EN_CURSO: { label: "En curso", variant: "success" },
    EN_PRESUPUESTO: { label: "En presupuesto", variant: "warning" },
    FINALIZADA: { label: "Finalizada", variant: "default" },
  };
  const e = estadoLabel[obra.estado] ?? { label: obra.estado, variant: "default" as const };

  return (
    <div className="animate-fade-in">
      {/* Hero header */}
      <div className="bg-gradient-to-br from-brand-800 via-brand-700 to-brand-900 text-white">
        <div className="max-w-[1600px] mx-auto px-6 lg:px-8 py-6">
          <button
            onClick={() => navigate("/obras")}
            className="inline-flex items-center gap-1.5 text-sm text-brand-100 hover:text-white transition-colors mb-3"
          >
            <ArrowLeft className="h-4 w-4" /> Volver a obras
          </button>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-brand-200 mb-1 font-mono">{obra.codigo}</p>
              <h1 className="text-3xl font-black tracking-tight">{obra.nombre}</h1>
            </div>
            <Badge variant={e.variant} className="text-sm">{e.label}</Badge>
          </div>

          {cronograma?.cronogramaCargado && cronograma.kpi && (
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <HeroStat label="Avance" value={fmtPct(cronograma.kpi.pctAcumulado)} />
              <HeroStat label="Costo directo" value={fmtMoney(cronograma.kpi.totalGlobal, { compact: true })} />
              <HeroStat label="Ejecutado a hoy" value={fmtMoney(cronograma.kpi.avanceMontoGlobal, { compact: true })} />
              <HeroStat label="Tareas" value={String(headerPpal?.lineasCount ?? 0)} />
            </div>
          )}
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 lg:px-8 py-6 space-y-6">
        <Tabs value={currentTab} onValueChange={(v) => navigate(`/obras/${id}/${v === "resumen" ? "" : v}`)}>
          <TabsList>
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="presupuesto">Presupuesto</TabsTrigger>
            <TabsTrigger value="planificacion">Planificación</TabsTrigger>
            <TabsTrigger value="retrospectiva" disabled={obra.estado !== "FINALIZADA"}>Retrospectiva</TabsTrigger>
          </TabsList>

          <TabsContent value="resumen">
            <ResumenTab obra={obra} presupuestos={presupuestos} cronograma={cronograma} navigate={navigate} />
          </TabsContent>

          <TabsContent value="presupuesto">
            <PresupuestoTab obraId={obra.id} presupuestos={presupuestos} navigate={navigate} />
          </TabsContent>

          <TabsContent value="planificacion">
            <PlanificacionTab obraId={obra.id} cronograma={cronograma} navigate={navigate} />
          </TabsContent>

          <TabsContent value="retrospectiva">
            <EmptyState
              icon={History}
              title="Retrospectiva no disponible"
              description="Se habilita cuando la obra está marcada como finalizada. Compara presupuesto vs ejecución real."
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wider text-brand-200 mb-1">{label}</p>
      <p className="text-2xl font-black stat-number">{value}</p>
    </div>
  );
}

// ─── Tab: Resumen ────────────────────────────────────────────────────────────
function ResumenTab({
  obra: _obra, presupuestos, cronograma, navigate,
}: {
  obra: Obra;
  presupuestos: Presupuesto[];
  cronograma: Cronograma | null;
  navigate: (path: string) => void;
}) {
  void _obra;
  const aprobado = presupuestos.find((p) => p.tipo === "APROBADO");
  const generador = presupuestos.find((p) => p.tipo === "GENERADOR");

  return (
    <div className="space-y-6">
      {/* Banner de próximos pasos */}
      {(!aprobado || !cronograma?.cronogramaCargado) && (generador || aprobado) && (
        <Card className="p-5 bg-gradient-to-br from-brand-50 to-stone-50 border-brand-200/60">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-brand-600 text-white grid place-items-center shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-stone-900 text-sm mb-2">Próximos pasos para esta obra</h3>
              <div className="space-y-2">
                {!aprobado && generador && (
                  <div className="flex items-center justify-between gap-3 p-3 bg-white rounded-lg border border-stone-200/60">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-stone-800">Agregar presupuesto aprobado</p>
                      <p className="text-2xs text-stone-500">Importá el xlsx aprobado con precio venta y cronograma mes a mes.</p>
                    </div>
                    <Button size="sm" onClick={() => navigate(`/catalogo/presupuestos/nuevo`)}>
                      <Upload /> Importar
                    </Button>
                  </div>
                )}
                {!cronograma?.cronogramaCargado && (
                  <div className="flex items-center justify-between gap-3 p-3 bg-white rounded-lg border border-stone-200/60">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-stone-800">Cargar cronograma</p>
                      <p className="text-2xs text-stone-500">
                        Creá una planificación manual o importá un xlsx con columnas MES 0..N.
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigate(`/catalogo/planificaciones/nueva`)}>
                      <FileSpreadsheet /> Planificación
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Presupuesto vigente */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Presupuesto vigente</CardTitle>
              {aprobado && <Badge variant="success">Aprobado</Badge>}
              {!aprobado && generador && <Badge variant="warning">Solo generador</Badge>}
              {!aprobado && !generador && <Badge variant="danger">Sin presupuesto</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {(aprobado ?? generador) ? (
              <>
                <div>
                  <p className="text-sm font-semibold text-stone-900">{(aprobado ?? generador)!.nombre ?? "Sin nombre"}</p>
                  <p className="text-xs text-stone-500">v{(aprobado ?? generador)!.version ?? "—"}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Costo directo" value={fmtMoney((aprobado ?? generador)!.totalCD, { compact: true })} />
                  <Stat label="Precio venta" value={fmtMoney((aprobado ?? generador)!.totalPV, { compact: true })} />
                  <Stat label="Tareas" value={String((aprobado ?? generador)!.lineasCount)} />
                  <Stat label="Rubros" value={String((aprobado ?? generador)!.rubrosCount)} />
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate(`/catalogo/presupuestos/${(aprobado ?? generador)!.id}`)}>
                  Abrir presupuesto →
                </Button>
              </>
            ) : (
              <EmptyState
                icon={Calculator}
                title="Sin presupuesto"
                action={<Button size="sm" onClick={() => navigate(`/catalogo/presupuestos/nuevo`)}>Crear presupuesto</Button>}
                className="py-8"
              />
            )}
          </CardContent>
        </Card>

        {/* Avance del cronograma */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Estado del cronograma</CardTitle>
              {cronograma?.cronogramaCargado ? <Badge variant="success">Cargado</Badge> : <Badge variant="warning">Sin cargar</Badge>}
            </div>
          </CardHeader>
          <CardContent>
            {cronograma?.cronogramaCargado && cronograma.kpi ? (
              <>
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-stone-600">Avance total</span>
                    <span className="font-bold text-stone-900 text-lg">{fmtPct(cronograma.kpi.pctAcumulado)}</span>
                  </div>
                  <Progress value={cronograma.kpi.pctAcumulado * 100} className="h-3" />
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <Stat label="Ejecutado" value={fmtMoney(cronograma.kpi.avanceMontoGlobal, { compact: true })} />
                  <Stat label="Restante" value={fmtMoney(cronograma.kpi.totalGlobal - cronograma.kpi.avanceMontoGlobal, { compact: true })} />
                </div>
              </>
            ) : (
              <EmptyState
                icon={Calendar}
                title="Sin cronograma"
                description="Importá un xlsx con MES 0..N o creá una planificación manual."
                action={
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => navigate(`/catalogo/planificaciones/nueva`)}>
                      <FileSpreadsheet /> Importar xlsx
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => navigate(`/catalogo/planificaciones/nueva`)}>
                      Crear manual
                    </Button>
                  </div>
                }
                className="py-4"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rubros breakdown */}
      {cronograma?.cronogramaCargado && cronograma.rubros.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Avance por rubro</CardTitle>
            <CardDescription>Estado de cada bloque del presupuesto</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {cronograma.rubros.slice(0, 12).map((r) => (
              <div key={r.nombre}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-stone-800">{r.nombre}</span>
                  <span className="text-stone-600">
                    <span className="font-bold mr-2">{fmtPct(r.pctEsperadoAhoy)}</span>
                    {fmtMoney(r.totalRubro, { compact: true })}
                  </span>
                </div>
                <Progress
                  value={r.pctEsperadoAhoy * 100}
                  indicatorClassName={
                    r.estado === "terminada" ? "bg-success-500" :
                    r.estado === "no_iniciada" ? "bg-stone-300" : "bg-brand-600"
                  }
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wider text-stone-400 mb-0.5">{label}</p>
      <p className="font-bold text-stone-900">{value}</p>
    </div>
  );
}

// ─── Tab: Presupuesto ────────────────────────────────────────────────────────
function PresupuestoTab({
  obraId, presupuestos, navigate,
}: {
  obraId: string;
  presupuestos: Presupuesto[];
  navigate: (path: string) => void;
}) {
  if (presupuestos.length === 0) {
    return (
      <EmptyState
        icon={Calculator}
        title="Esta obra no tiene presupuesto"
        description="Creá uno desde un xlsx importado o manualmente."
        action={<Button onClick={() => navigate("/catalogo/presupuestos/nuevo")}>Crear presupuesto</Button>}
      />
    );
  }
  void obraId;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {presupuestos.map((p) => (
          <Card key={p.id} className="p-5 hover:shadow-md hover:border-brand-300 cursor-pointer transition-all"
                onClick={() => navigate(`/catalogo/presupuestos/${p.id}`)}>
            <div className="flex items-center justify-between mb-3">
              <Badge variant={p.tipo === "APROBADO" ? "success" : "brand"}>{p.tipo}</Badge>
              <span className="text-2xs text-stone-400">{p.estado}</span>
            </div>
            <p className="font-semibold text-stone-900">{p.nombre ?? "Sin nombre"}</p>
            <p className="text-xs text-stone-500 mb-3">v{p.version ?? "—"}</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Stat label="CD" value={fmtMoney(p.totalCD, { compact: true })} />
              <Stat label="PV" value={fmtMoney(p.totalPV, { compact: true })} />
              <Stat label="Tareas" value={String(p.lineasCount)} />
              <Stat label="Rubros" value={String(p.rubrosCount)} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: Planificación ──────────────────────────────────────────────────────
function PlanificacionTab({
  obraId, cronograma, navigate,
}: {
  obraId: string;
  cronograma: Cronograma | null;
  navigate: (path: string) => void;
}) {
  const [planificaciones, setPlanificaciones] = useState<{ id: string; nombre: string; duracionMeses: number; fechaInicio: string; _count: { filas: number } }[]>([]);
  useEffect(() => {
    apiFetch(`/api/planificacion`)
      .then((r) => r.json())
      .then((list) => setPlanificaciones((list as { id: string; nombre: string; duracionMeses: number; fechaInicio: string; _count: { filas: number }; obra: { id: string } }[]).filter((p) => p.obra.id === obraId)));
  }, [obraId]);

  // Datos para chart curva S
  const chartData = cronograma?.cronogramaCargado && cronograma.kpi
    ? cronograma.meses.map((m, i) => ({
        mes: m.etiqueta,
        // Acumulado teórico — necesitaríamos backend para esto exacto, aprox lineal
        avance: ((i + 1) / cronograma.meses.length) * 100,
      }))
    : [];

  return (
    <div className="space-y-6">
      {cronograma?.cronogramaCargado && chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Curva S (avance esperado)</CardTitle>
            <CardDescription>Distribución del avance a lo largo del cronograma</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="curva" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3f8276" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#3f8276" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "#78716c" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#78716c" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <ReTooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid #e7e5e4", fontSize: 12 }}
                    formatter={(v) => `${Number(v).toFixed(1)}%`}
                  />
                  <Area type="monotone" dataKey="avance" stroke="#2d5d52" strokeWidth={2} fill="url(#curva)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-stone-900">Planificaciones de la obra</h3>
          <Button size="sm" onClick={() => navigate("/catalogo/planificaciones/nueva")}>
            <Upload /> Nueva planificación
          </Button>
        </div>
        {planificaciones.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="Sin planificaciones"
            description="Importá un xlsx con MES 0..N o creá una planificación manual."
            action={
              <div className="flex gap-2">
                <Button size="sm" onClick={() => navigate("/catalogo/planificaciones/nueva")}>
                  <FileSpreadsheet /> Importar xlsx
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigate("/catalogo/planificaciones/nueva")}>
                  Crear manual
                </Button>
              </div>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {planificaciones.map((p) => (
              <Card key={p.id} className="p-5 hover:shadow-md hover:border-brand-300 cursor-pointer transition-all"
                    onClick={() => navigate(`/catalogo/planificaciones/${p.id}`)}>
                <p className="font-semibold text-stone-900 mb-3">{p.nombre}</p>
                <div className="flex items-center gap-4 text-xs text-stone-600">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3 text-stone-400" />{fmtDate(p.fechaInicio, "month")}</span>
                  <span className="flex items-center gap-1"><Layers className="h-3 w-3 text-stone-400" />{p._count.filas} tareas</span>
                  <span className="flex items-center gap-1"><BarChart3 className="h-3 w-3 text-stone-400" />{p.duracionMeses}m</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {!cronograma?.cronogramaCargado && (
        <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-100 rounded-xl">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-800">
            Esta obra todavía no tiene cronograma cargado. Subí un presupuesto aprobado con MES 0..N o creá una planificación manualmente.
          </p>
        </div>
      )}
      {void TrendingUp}
    </div>
  );
}

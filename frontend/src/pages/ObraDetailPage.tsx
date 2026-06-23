import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Building2, Calendar, AlertTriangle,
  Calculator, History, Upload, Sparkles, FileSpreadsheet, TrendingUp,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { apiFetch } from "../lib/api";
import { fmtMoney, fmtNum, fmtPct, fmtDate } from "../lib/format";
import { CronogramaEditor } from "../components/CronogramaEditor";
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
  serieMensual?: { mesOrdinal: number; fecha: string; pctMes: number; pctAcumulado: number }[];
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
              <HeroStat label="Avance previsto" value={fmtPct(cronograma.kpi.pctAcumulado)} />
              <HeroStat label="Costo directo" value={fmtMoney(cronograma.kpi.totalGlobal, { compact: true })} />
              <HeroStat label="Previsto a hoy" value={fmtMoney(cronograma.kpi.avanceMontoGlobal, { compact: true })} />
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
            <PresupuestoTab obraId={obra.id} />
          </TabsContent>

          <TabsContent value="planificacion">
            <CronogramaTab obraId={obra.id} cronograma={cronograma} />
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
  obra, presupuestos, cronograma, navigate,
}: {
  obra: Obra;
  presupuestos: Presupuesto[];
  cronograma: Cronograma | null;
  navigate: (path: string) => void;
}) {
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
                <Button variant="outline" size="sm" onClick={() => navigate(`/obras/${obra.id}/presupuesto`)}>
                  Ver presupuesto →
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
                    <span className="text-stone-600">Avance previsto</span>
                    <span className="font-bold text-stone-900 text-lg">{fmtPct(cronograma.kpi.pctAcumulado)}</span>
                  </div>
                  <Progress value={cronograma.kpi.pctAcumulado * 100} className="h-3" />
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <Stat label="Previsto a hoy" value={fmtMoney(cronograma.kpi.avanceMontoGlobal, { compact: true })} />
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

      {/* Avance real de obra (reportado en obra) */}
      <AvanceRealCard
        obraId={obra.id}
        previsto={cronograma?.cronogramaCargado ? cronograma.kpi?.pctAcumulado ?? null : null}
        navigate={navigate}
      />

      {/* Rubros breakdown */}
      {cronograma?.cronogramaCargado && cronograma.rubros.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Avance previsto por rubro</CardTitle>
            <CardDescription>Lo que el plan prevé ejecutado a hoy — no es avance real</CardDescription>
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

// ─── Tab: Presupuesto (inline, desglose MAT/MO/EQ/PV por rubro) ───────────────
interface PptoLinea {
  id: string; itemNumero: string | null; descripcion: string; unidad: string; cantidad: number;
  matUd: number | null; moUd: number | null; eqUd: number | null;
  precioUnitario: number; precioVenta: number; total: number; fuente: string | null;
}
interface PptoRubro {
  nombre: string; normalizado: boolean;
  totalMat: number; totalMO: number; totalEQ: number; totalPV: number; totalRubro: number;
  lineas: PptoLinea[];
}
interface PptoIcc {
  base: number | null;
  actual: number | null;
  coef: number | null;
  mesBase: string | null;
  mesActual: string | null;
  variacionMensual: number | null;
}
interface PptoData {
  presupuesto: { nombre: string | null; version: string | null; mesCac: string; coefGGBB: number | null } | null;
  cacValor: number | null;
  icc?: PptoIcc;
  totalMat: number; totalMO: number; totalEQ: number; totalGeneral: number; totalPV: number;
  rubros: PptoRubro[];
}

function PresupuestoTab({ obraId }: { obraId: string }) {
  const [data, setData] = useState<PptoData | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/obras/${obraId}/presupuesto`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: PptoData | null) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [obraId]);

  if (loading) return <div className="py-12 text-center text-stone-400 text-sm">Cargando presupuesto…</div>;
  if (!data || data.rubros.length === 0) {
    return <EmptyState icon={Calculator} title="Sin presupuesto" description="Importá el APU Unificado de la obra para ver el presupuesto." />;
  }

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-stone-900 to-stone-800 text-white rounded-2xl p-5 grid grid-cols-2 md:grid-cols-5 gap-4">
        <DarkStat label="Materiales" value={fmtMoney(data.totalMat, { compact: true })} />
        <DarkStat label="Mano de obra" value={fmtMoney(data.totalMO, { compact: true })} />
        <DarkStat label="Equipos" value={fmtMoney(data.totalEQ, { compact: true })} />
        <DarkStat label="Costo directo" value={fmtMoney(data.totalGeneral, { compact: true })} />
        <DarkStat label="Precio venta" value={fmtMoney(data.totalPV, { compact: true })} accent />
      </div>
      <IccPptoBlock icc={data.icc} cacValor={data.cacValor} totalPV={data.totalPV} totalCD={data.totalGeneral} />
      {data.rubros.map((r) => <RubroPptoSection key={r.nombre} rubro={r} />)}
    </div>
  );
}

// Tarjeta de avance REAL reportado en obra, con comparación contra el previsto del cronograma.
interface AvanceRubro { nombre: string; pctAcumulado: number; tareas: unknown[] }
interface AvanceResp { avanceGlobal: { pctReal: number }; rubros: AvanceRubro[] }
function AvanceRealCard({ obraId, previsto, navigate }: { obraId: string; previsto: number | null; navigate: (p: string) => void }) {
  const [data, setData] = useState<AvanceResp | null>(null);
  useEffect(() => {
    apiFetch(`/api/obras/${obraId}/avance`).then((r) => (r.ok ? r.json() : null)).then(setData).catch(() => {});
  }, [obraId]);

  const real = data?.avanceGlobal.pctReal ?? 0;
  const conReportes = (data?.rubros ?? []).some((r) => r.pctAcumulado > 0);
  const topRubros = (data?.rubros ?? []).filter((r) => r.pctAcumulado > 0).sort((a, b) => b.pctAcumulado - a.pctAcumulado).slice(0, 8);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle>Avance real de obra</CardTitle>
            <CardDescription>Reportado en obra — ponderado por costo</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => navigate("/avance")}>
            <TrendingUp /> Reportar avance
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-stone-600">Ejecutado real</span>
            <span className="font-bold text-stone-900 text-lg">{fmtPct(real)}</span>
          </div>
          <Progress value={real * 100} className="h-3" indicatorClassName="bg-emerald-600" />
          {previsto != null && (
            <p className="text-2xs text-stone-500 mt-1.5">
              Previsto a hoy: <span className="font-semibold">{fmtPct(previsto)}</span>
              {real < previsto ? " · vas por detrás del plan" : real > previsto ? " · vas adelante del plan" : ""}
            </p>
          )}
        </div>
        {conReportes ? (
          <div className="space-y-2">
            {topRubros.map((r) => (
              <div key={r.nombre}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-stone-800 truncate mr-2">{r.nombre}</span>
                  <span className="font-bold text-stone-600 tabular-nums">{fmtPct(r.pctAcumulado)}</span>
                </div>
                <Progress value={r.pctAcumulado * 100} indicatorClassName="bg-emerald-500" />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-stone-400">Todavía no se reportó avance. Tocá "Reportar avance" para cargar desde el celular.</p>
        )}
      </CardContent>
    </Card>
  );
}

function IccPptoBlock({ icc, cacValor, totalPV, totalCD }: { icc?: PptoIcc; cacValor: number | null; totalPV: number; totalCD: number }) {
  const navigate = useNavigate();
  const base = totalPV > 0 ? totalPV : totalCD;

  // Coeficiente disponible → mostrar precio actualizado
  if (icc?.coef != null && icc.coef > 0) {
    return (
      <Card className="p-5 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200/70">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-amber-700" />
              <p className="text-xs uppercase tracking-wider text-amber-700 font-semibold">Precio actualizado por ICC · INDEC</p>
            </div>
            <p className="text-[11px] text-amber-600 mt-0.5">
              {icc.mesBase ?? "base"} → {icc.mesActual ?? "actual"} · ICC {icc.base?.toLocaleString("es-AR")} → {icc.actual?.toLocaleString("es-AR")}
            </p>
          </div>
          <div className="flex items-center gap-3 sm:gap-6">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-stone-400 mb-0.5">Presupuestado</p>
              <p className="text-xs sm:text-sm font-semibold text-stone-500 line-through tabular-nums">{fmtMoney(base, { compact: true })}</p>
            </div>
            <div className="text-lg sm:text-2xl font-black text-amber-700 tabular-nums">×{icc.coef.toFixed(3)}</div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-amber-700 mb-0.5 font-semibold">Precio a hoy</p>
              <p className="text-lg sm:text-2xl font-black text-stone-900 tabular-nums">{fmtMoney(base * icc.coef, { compact: true })}</p>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // Tiene base ICC pero falta el valor actual → guiar a cargarlo
  if (cacValor && cacValor > 0) {
    return (
      <Card className="p-4 bg-stone-50 border-stone-200/70">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs text-stone-500">
            <span className="font-semibold text-stone-700">ICC base del presupuesto:</span> {cacValor.toLocaleString("es-AR")}
            {icc?.mesBase ? ` (${icc.mesBase})` : ""}
            {icc?.variacionMensual != null ? ` · último dato INDEC ${icc.mesActual}: +${icc.variacionMensual.toFixed(1)}% mensual` : ""}
          </p>
          <button
            onClick={() => navigate("/")}
            className="text-xs font-medium text-amber-700 hover:text-amber-800 underline underline-offset-2"
          >
            Ingresar nivel ICC actual para ver el precio a hoy →
          </button>
        </div>
      </Card>
    );
  }

  return null;
}

function DarkStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wider text-stone-400 mb-1">{label}</p>
      <p className={`text-xl font-black stat-number ${accent ? "text-brand-300" : ""}`}>{value}</p>
    </div>
  );
}

function RubroPptoSection({ rubro }: { rubro: PptoRubro }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="overflow-hidden p-0">
      <button onClick={() => setOpen(!open)} className="w-full px-5 py-3 bg-stone-50 border-b border-stone-100 flex items-center justify-between hover:bg-stone-100 transition-colors">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] text-stone-400">{open ? "▼" : "▶"}</span>
          <h3 className="font-bold text-stone-800 text-sm uppercase truncate">{rubro.nombre}</h3>
          <span className="text-xs text-stone-400">({rubro.lineas.length})</span>
        </div>
        <div className="flex items-center gap-4 text-xs shrink-0">
          <span className="text-stone-400">CD <span className="font-semibold text-stone-700">{fmtMoney(rubro.totalRubro, { compact: true })}</span></span>
          <span className="text-stone-400">PV <span className="font-semibold text-stone-900">{fmtMoney(rubro.totalPV, { compact: true })}</span></span>
        </div>
      </button>
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-stone-500 border-b border-stone-100">
              <tr>
                <th className="text-left px-4 py-2 font-medium w-14">Item</th>
                <th className="text-left px-4 py-2 font-medium">Descripción</th>
                <th className="text-left px-3 py-2 font-medium w-12">Ud</th>
                <th className="text-right px-3 py-2 font-medium w-20">Cant</th>
                <th className="text-right px-3 py-2 font-medium w-28">MAT/ud</th>
                <th className="text-right px-3 py-2 font-medium w-28">MO/ud</th>
                <th className="text-right px-3 py-2 font-medium w-24">EQ/ud</th>
                <th className="text-right px-3 py-2 font-medium w-28">CD/ud</th>
                <th className="text-right px-4 py-2 font-medium w-32">Total CD</th>
                <th className="text-right px-4 py-2 font-medium w-32">Precio venta</th>
              </tr>
            </thead>
            <tbody>
              {rubro.lineas.map((l) => (
                <tr key={l.id} className="border-b border-stone-50 hover:bg-stone-50/50">
                  <td className="px-4 py-2 font-mono text-xs text-stone-500">{l.itemNumero}</td>
                  <td className="px-4 py-2 text-stone-800"><span className="block truncate max-w-md" title={l.descripcion}>{l.descripcion}</span></td>
                  <td className="px-3 py-2 text-xs text-stone-500">{l.unidad}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">{fmtNum(l.cantidad)}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums text-stone-500">{l.matUd ? fmtMoney(l.matUd, { compact: true }) : "—"}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums text-stone-500">{l.moUd ? fmtMoney(l.moUd, { compact: true }) : "—"}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums text-stone-500">{l.eqUd ? fmtMoney(l.eqUd, { compact: true }) : "—"}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">{fmtMoney(l.precioUnitario, { compact: true })}</td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums">{fmtMoney(l.total, { compact: true })}</td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums text-brand-700">{fmtMoney(l.precioVenta * l.cantidad, { compact: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ─── Tab: Cronograma (inline: avance previsto + tareas e insumos del mes) ─────
interface CronoTarea { itemNumero: string | null; descripcion: string; cantidad: number; unidad: string | null; pctEjecucionMes: number }
interface CronoRubro { nombre: string; totalRubro: number; pctEsperadoAhoy: number; estado: string; tareasActivasMes: CronoTarea[] }
interface CronoInsumo { codigo: string; descripcion: string; tipo: string; unidad: string; cantidad: number }
interface CronoFull {
  cronogramaCargado: boolean;
  serieMensual?: { fecha: string; pctAcumulado: number }[];
  kpi: { totalGlobal: number; avanceMontoGlobal: number; pctAcumulado: number } | null;
  meses: { mesOrdinal: number; fecha: string; etiqueta: string }[];
  mesSeleccionado: { mesOrdinal: number; fecha: string } | null;
  rubros: CronoRubro[];
  insumosDelMes: CronoInsumo[];
}

const TIPO_LABEL: Record<string, string> = { MANO_DE_OBRA: "MO", MATERIAL: "MAT", EQUIPO: "EQ", SUBCONTRATO: "SUB" };
const TIPO_COLOR: Record<string, string> = {
  MANO_DE_OBRA: "bg-amber-50 text-amber-600", MATERIAL: "bg-blue-50 text-blue-600",
  EQUIPO: "bg-violet-50 text-violet-600", SUBCONTRATO: "bg-teal-50 text-teal-600",
};

function CronogramaTab({ obraId, cronograma }: { obraId: string; cronograma: Cronograma | null }) {
  const [mes, setMes] = useState<string | undefined>(undefined);
  const [data, setData] = useState<CronoFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    const q = mes ? `?mes=${mes}` : "";
    apiFetch(`/api/obras/${obraId}/cronograma${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: CronoFull | null) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [obraId, mes, reloadKey]);

  if (!cronograma?.cronogramaCargado) {
    return (
      <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-100 rounded-xl">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
        <p className="text-xs text-amber-800">
          Esta obra todavía no tiene cronograma cargado. Importá el APU Unificado con la hoja PPTO_APROBADO (precio de venta + meses).
        </p>
      </div>
    );
  }

  if (editing) {
    return <CronogramaEditor obraId={obraId} onClose={(saved) => { setEditing(false); if (saved) setReloadKey((k) => k + 1); }} />;
  }

  const chartData = (data?.serieMensual ?? cronograma.serieMensual ?? []).map((m) => ({
    mes: fmtDate(m.fecha, "month"),
    avance: m.pctAcumulado * 100,
  }));
  const mesSelISO = data?.mesSeleccionado?.fecha ?? null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-stone-500">Cronograma aprobado de la obra — avance previsto mes a mes.</p>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Calendar className="h-4 w-4" /> Editar cronograma
        </Button>
      </div>
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Curva S (avance previsto)</CardTitle>
            <CardDescription>Acumulado mensual según el cronograma aprobado — no es avance real</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56">
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
                  <ReTooltip contentStyle={{ borderRadius: 8, border: "1px solid #e7e5e4", fontSize: 12 }} formatter={(v) => `${Number(v).toFixed(1)}%`} />
                  <Area type="monotone" dataKey="avance" stroke="#2d5d52" strokeWidth={2} fill="url(#curva)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selector de mes */}
      {data && data.meses.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {data.meses.map((m) => {
            const active = mesSelISO != null && m.fecha.slice(0, 7) === mesSelISO.slice(0, 7);
            return (
              <button key={m.mesOrdinal} onClick={() => setMes(m.fecha.slice(0, 10))}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${active ? "bg-brand-700 text-white border-brand-700" : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"}`}>
                {fmtDate(m.fecha, "month")}
              </button>
            );
          })}
        </div>
      )}

      {loading && !data ? (
        <div className="py-12 text-center text-stone-400 text-sm">Cargando cronograma…</div>
      ) : data ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Avance previsto por rubro */}
          <Card>
            <CardHeader>
              <CardTitle>Avance previsto por rubro</CardTitle>
              <CardDescription>Lo que el plan prevé ejecutado al mes seleccionado</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.rubros.slice(0, 14).map((r) => (
                <div key={r.nombre}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-stone-800 truncate pr-2">{r.nombre}</span>
                    <span className="text-stone-600 shrink-0"><span className="font-bold mr-2">{fmtPct(r.pctEsperadoAhoy)}</span>{fmtMoney(r.totalRubro, { compact: true })}</span>
                  </div>
                  <Progress value={r.pctEsperadoAhoy * 100} indicatorClassName={r.estado === "terminada" ? "bg-success-500" : r.estado === "no_iniciada" ? "bg-stone-300" : "bg-brand-600"} />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Insumos del mes */}
          <Card>
            <CardHeader>
              <CardTitle>Insumos del mes</CardTitle>
              <CardDescription>Lo que el plan prevé consumir en el mes seleccionado</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {data.insumosDelMes.length === 0 ? (
                <p className="text-xs text-stone-400 text-center py-8">Sin insumos previstos para este mes.</p>
              ) : (
                <div className="max-h-[420px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      {data.insumosDelMes.slice(0, 60).map((i) => (
                        <tr key={i.codigo} className="border-b border-stone-50 hover:bg-stone-50/50">
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`text-2xs px-1.5 py-0.5 rounded font-medium shrink-0 ${TIPO_COLOR[i.tipo] ?? "bg-stone-100 text-stone-500"}`}>{TIPO_LABEL[i.tipo] ?? i.tipo}</span>
                              <span className="text-xs text-stone-800 truncate" title={i.descripcion}>{i.descripcion}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right whitespace-nowrap tabular-nums text-xs font-semibold text-stone-900">
                            {fmtNum(i.cantidad, i.cantidad >= 100 ? 0 : 2)} <span className="text-2xs font-normal text-stone-400">{i.unidad}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tareas activas del mes */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Tareas previstas en el mes</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {(() => {
                const tareas = data.rubros.flatMap((r) => r.tareasActivasMes.map((t) => ({ ...t, rubro: r.nombre })));
                if (tareas.length === 0) return <p className="text-xs text-stone-400 text-center py-8">Sin tareas previstas para este mes.</p>;
                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-stone-500 border-b border-stone-100">
                        <tr>
                          <th className="text-left px-4 py-2 font-medium w-14">Item</th>
                          <th className="text-left px-4 py-2 font-medium">Tarea</th>
                          <th className="text-left px-4 py-2 font-medium">Rubro</th>
                          <th className="text-right px-4 py-2 font-medium w-24">% del mes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tareas.map((t, idx) => (
                          <tr key={`${t.itemNumero}-${idx}`} className="border-b border-stone-50 hover:bg-stone-50/50">
                            <td className="px-4 py-2 font-mono text-xs text-stone-500">{t.itemNumero}</td>
                            <td className="px-4 py-2 text-stone-800"><span className="block truncate max-w-md" title={t.descripcion}>{t.descripcion}</span></td>
                            <td className="px-4 py-2 text-xs text-stone-500">{t.rubro}</td>
                            <td className="px-4 py-2 text-right text-xs font-semibold tabular-nums text-brand-700">{fmtPct(t.pctEjecucionMes)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

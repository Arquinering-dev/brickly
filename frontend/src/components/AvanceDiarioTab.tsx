import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { apiFetch } from "../lib/api";
import { fmtPct } from "../lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";
import { EmptyState } from "./ui/empty";

interface ReporteDia {
  id: string;
  lineaId: string;
  itemNumero: string | null;
  descripcion: string;
  rubro: string;
  unidad: string;
  pctIncremento: number; // fracción 0..1 cargada ese día
  cantidad: number | null;
  nota: string | null;
  hora: string; // ISO
}
interface DiaAvance { fecha: string; reportes: number; tareas: ReporteDia[] }

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DOW = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const pad = (n: number) => String(n).padStart(2, "0");
const horaLocal = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

export function AvanceDiarioTab({ obraId }: { obraId: string }) {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [anio, setAnio] = useState(now.getFullYear());
  const [dias, setDias] = useState<DiaAvance[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setDias(null);
    setError(null);
    try {
      const r = await apiFetch(`/api/obras/${obraId}/avance/diario?mes=${mes}&anio=${anio}`);
      if (!r.ok) throw new Error((await r.json()).error ?? "Error");
      const d = await r.json();
      setDias(d.dias ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar el avance diario");
      setDias([]);
    }
  }, [obraId, mes, anio]);

  useEffect(() => { cargar(); }, [cargar]);

  const porFecha = useMemo(() => {
    const m = new Map<string, DiaAvance>();
    for (const d of dias ?? []) m.set(d.fecha, d);
    return m;
  }, [dias]);

  // Auto-seleccionar el primer día con reportes al cargar el mes.
  useEffect(() => {
    if (dias && dias.length > 0) setSel(dias[dias.length - 1].fecha);
    else setSel(null);
  }, [dias]);

  // Grilla del mes (semanas empezando lunes).
  const celdas = useMemo(() => {
    const primero = new Date(anio, mes - 1, 1);
    const offset = (primero.getDay() + 6) % 7; // lunes = 0
    const diasEnMes = new Date(anio, mes, 0).getDate();
    const arr: (number | null)[] = [];
    for (let i = 0; i < offset; i++) arr.push(null);
    for (let d = 1; d <= diasEnMes; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [mes, anio]);

  const navegar = (delta: number) => {
    let m = mes + delta, a = anio;
    if (m < 1) { m = 12; a--; } else if (m > 12) { m = 1; a++; }
    setMes(m); setAnio(a);
  };

  const fechaDe = (d: number) => `${anio}-${pad(mes)}-${pad(d)}`;
  const hoyStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const diaSel = sel ? porFecha.get(sel) : undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Avance diario</h2>
          <p className="text-sm text-slate-500">Lo que el jefe de obra reportó cada día. Entrá a un día para ver las tareas y el % cargado.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon-sm" onClick={() => navegar(-1)} title="Mes anterior"><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-semibold w-36 text-center">{MESES[mes - 1]} {anio}</span>
          <Button variant="outline" size="icon-sm" onClick={() => navegar(1)} title="Mes siguiente"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Calendario */}
        <Card className="lg:col-span-3">
          <CardContent className="p-4">
            {dias === null ? (
              <Skeleton className="h-72 w-full" />
            ) : (
              <>
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {DOW.map((d) => <div key={d} className="text-center text-xs font-medium text-slate-400 py-1">{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {celdas.map((d, i) => {
                    if (d === null) return <div key={`b${i}`} />;
                    const f = fechaDe(d);
                    const dia = porFecha.get(f);
                    const tieneReportes = !!dia;
                    const esSel = sel === f;
                    const esHoy = f === hoyStr;
                    return (
                      <button
                        key={f}
                        onClick={() => tieneReportes && setSel(f)}
                        disabled={!tieneReportes}
                        className={[
                          "aspect-square rounded-lg border p-1.5 text-left flex flex-col transition-colors",
                          tieneReportes ? "cursor-pointer hover:border-brand-400" : "cursor-default",
                          esSel ? "border-brand-500 bg-brand-50" : "border-slate-100",
                          !tieneReportes ? "bg-slate-50/40" : "",
                        ].join(" ")}
                      >
                        <span className={[
                          "text-xs font-medium",
                          esHoy ? "text-brand-700 font-bold" : tieneReportes ? "text-slate-700" : "text-slate-300",
                        ].join(" ")}>{d}</span>
                        {tieneReportes && (
                          <span className="mt-auto inline-flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                            <span className="text-[10px] text-slate-500">{dia!.reportes}</span>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Detalle del día */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4" />
              {diaSel ? diaTitulo(diaSel.fecha) : "Seleccioná un día"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!diaSel ? (
              dias && dias.length === 0 ? (
                <EmptyState icon={CalendarDays} title="Sin reportes este mes" description="No hay avance cargado en este mes. Probá con otro." />
              ) : (
                <p className="text-sm text-slate-400">Tocá un día con reportes en el calendario.</p>
              )
            ) : (
              <div className="space-y-3">
                {diaSel.tareas.map((t) => (
                  <div key={t.id} className="rounded-lg border border-slate-100 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{t.descripcion}</p>
                        <p className="text-xs text-slate-400">
                          {t.itemNumero ? `${t.itemNumero} · ` : ""}{t.rubro} · {horaLocal(t.hora)}
                        </p>
                      </div>
                      <Badge variant="brand">+{fmtPct(t.pctIncremento)}</Badge>
                    </div>
                    {(t.cantidad != null || t.nota) && (
                      <p className="text-xs text-slate-500 mt-1.5">
                        {t.cantidad != null ? `${t.cantidad} ${t.unidad}` : ""}
                        {t.cantidad != null && t.nota ? " · " : ""}
                        {t.nota ?? ""}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function diaTitulo(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const dt = new Date(a, m - 1, d);
  const dow = dt.toLocaleDateString("es-AR", { weekday: "long" });
  return `${dow.charAt(0).toUpperCase()}${dow.slice(1)} ${d} de ${MESES[m - 1]}`;
}

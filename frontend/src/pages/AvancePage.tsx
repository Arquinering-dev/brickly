import { useEffect, useState } from "react";
import { ChevronDown, TrendingUp, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "../lib/api";
import { fmtNum } from "../lib/format";

interface Tarea {
  lineaId: string;
  itemNumero: string | null;
  descripcion: string;
  unidad: string;
  cantidad: number;
  costoDirecto: number;
  pctAcumulado: number;        // fracción 0..1
  cantidadEjecutada: number;
  ultimoReporte: string | null;
}
interface Rubro {
  nombre: string;
  pctAcumulado: number;
  tareas: Tarea[];
}
interface AvanceData {
  obra: { id: string; nombre: string; codigo: string };
  rubros: Rubro[];
  avanceGlobal: { pctReal: number; costoDirecto?: number; montoEjecutado?: number };
}
interface ObraLite { id: string; nombre: string; codigo: string }

export default function AvancePage() {
  const [obras, setObras] = useState<ObraLite[]>([]);
  const [obraId, setObraId] = useState<string>("");
  const [data, setData] = useState<AvanceData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch("/api/obras")
      .then((r) => r.json())
      .then((list: ObraLite[]) => {
        setObras(list);
        if (list.length) setObraId((prev) => prev || list[0].id);
      })
      .catch(() => toast.error("No se pudieron cargar las obras"));
  }, []);

  function load(id: string) {
    if (!id) return;
    setLoading(true);
    apiFetch(`/api/obras/${id}/avance`)
      .then((r) => r.json())
      .then((d: AvanceData) => setData(d))
      .catch(() => toast.error("Error al cargar el avance"))
      .finally(() => setLoading(false));
  }
  useEffect(() => { if (obraId) load(obraId); }, [obraId]);

  function onReported() { load(obraId); }

  return (
    <div className="min-h-screen bg-surface">
      {/* Encabezado sticky con selector de obra + avance global */}
      <div className="sticky top-0 z-10 bg-white border-b border-stone-200 px-4 py-3 space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-brand-600 shrink-0" />
          <h1 className="text-lg font-black text-stone-900">Reporte de avance</h1>
        </div>
        <select
          value={obraId}
          onChange={(e) => setObraId(e.target.value)}
          className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          {obras.length === 0 && <option>Cargando obras…</option>}
          {obras.map((o) => (
            <option key={o.id} value={o.id}>{o.nombre}</option>
          ))}
        </select>
        {data && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-2xs uppercase tracking-wider text-stone-400 font-semibold">Avance real de obra</span>
              <span className="text-sm font-black text-brand-700">{(data.avanceGlobal.pctReal * 100).toFixed(1)}%</span>
            </div>
            <Bar pct={data.avanceGlobal.pctReal} thick />
          </div>
        )}
      </div>

      <div className="px-3 py-4 max-w-2xl mx-auto space-y-2.5 pb-24">
        {loading && !data && <p className="text-center text-stone-400 text-sm py-10">Cargando…</p>}
        {data && data.rubros.length === 0 && (
          <p className="text-center text-stone-400 text-sm py-10">
            Esta obra no tiene presupuesto cargado todavía.
          </p>
        )}
        {data?.rubros.map((r) => (
          <RubroCard key={r.nombre} rubro={r} obraId={obraId} onReported={onReported} />
        ))}
      </div>
    </div>
  );
}

function Bar({ pct, thick }: { pct: number; thick?: boolean }) {
  const v = Math.min(100, Math.max(0, pct * 100));
  return (
    <div className={`w-full rounded-full bg-stone-200 overflow-hidden ${thick ? "h-2.5" : "h-1.5"}`}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600 transition-all"
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

function RubroCard({ rubro, obraId, onReported }: { rubro: Rubro; obraId: string; onReported: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center gap-3 active:bg-stone-50"
      >
        <ChevronDown className={`h-4 w-4 text-stone-400 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`} />
        <div className="flex-1 min-w-0 text-left">
          <p className="font-bold text-stone-800 text-sm uppercase truncate">{rubro.nombre}</p>
          <div className="mt-1.5"><Bar pct={rubro.pctAcumulado} /></div>
        </div>
        <span className="text-sm font-black text-stone-700 tabular-nums shrink-0">{(rubro.pctAcumulado * 100).toFixed(0)}%</span>
      </button>
      {open && (
        <div className="border-t border-stone-100 divide-y divide-stone-100">
          {rubro.tareas.map((t) => (
            <TareaRow key={t.lineaId} tarea={t} obraId={obraId} onReported={onReported} />
          ))}
        </div>
      )}
    </div>
  );
}

function TareaRow({ tarea, obraId, onReported }: { tarea: Tarea; obraId: string; onReported: () => void }) {
  const [modo, setModo] = useState<"pct" | "cant">("pct");
  const [valor, setValor] = useState("");
  const [saving, setSaving] = useState(false);

  const num = parseFloat(valor.replace(",", "."));
  const tieneCantidad = tarea.cantidad > 0;
  // Preview del total que quedaría
  const incrFrac =
    !isNaN(num) && num > 0
      ? modo === "pct" ? num / 100 : (tieneCantidad ? num / tarea.cantidad : 0)
      : 0;
  const totalPreview = Math.min(1, tarea.pctAcumulado + incrFrac);
  const completa = tarea.pctAcumulado >= 0.9999;

  async function reportar() {
    if (isNaN(num) || num <= 0) { toast.error("Ingresá un valor mayor a 0"); return; }
    setSaving(true);
    try {
      const body = modo === "pct" ? { lineaId: tarea.lineaId, pctIncremento: num } : { lineaId: tarea.lineaId, cantidad: num };
      const res = await apiFetch(`/api/obras/${obraId}/avance`, { method: "POST", body: JSON.stringify(body) });
      const d = await res.json() as { ok?: boolean; pctAnterior?: number; pctAcumulado?: number; error?: string };
      if (!res.ok || !d.ok) throw new Error(d.error ?? "Error");
      toast.success(`${tarea.itemNumero ?? ""} ${((d.pctAnterior ?? 0) * 100).toFixed(0)}% → ${((d.pctAcumulado ?? 0) * 100).toFixed(0)}%`);
      setValor("");
      onReported();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al reportar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-stone-800">
            {tarea.itemNumero && <span className="font-mono text-2xs text-stone-400 mr-1.5">{tarea.itemNumero}</span>}
            {tarea.descripcion}
          </p>
          <p className="text-2xs text-stone-400 mt-0.5">
            {fmtNum(tarea.cantidad)} {tarea.unidad}
            {tarea.pctAcumulado > 0 && <> · ejecutado {fmtNum(tarea.cantidadEjecutada)} {tarea.unidad}</>}
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className={`text-sm font-black tabular-nums ${completa ? "text-emerald-600" : "text-stone-700"}`}>
            {(tarea.pctAcumulado * 100).toFixed(0)}%
          </span>
          {completa && <Check className="h-3.5 w-3.5 text-emerald-600 inline-block ml-1" />}
        </div>
      </div>
      <div className="mt-1.5"><Bar pct={tarea.pctAcumulado} /></div>

      {!completa && (
        <div className="mt-2.5 flex items-center gap-2">
          {/* Toggle %/cantidad */}
          <div className="flex rounded-lg border border-stone-200 overflow-hidden text-2xs shrink-0">
            <button
              onClick={() => setModo("pct")}
              className={`px-2.5 py-2 font-semibold ${modo === "pct" ? "bg-brand-600 text-white" : "bg-white text-stone-500"}`}
            >%</button>
            <button
              onClick={() => tieneCantidad && setModo("cant")}
              disabled={!tieneCantidad}
              className={`px-2.5 py-2 font-semibold ${modo === "cant" ? "bg-brand-600 text-white" : "bg-white text-stone-500"} ${!tieneCantidad ? "opacity-40" : ""}`}
            >cant.</button>
          </div>
          <input
            type="number"
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder={modo === "pct" ? "+% de hoy" : `+${tarea.unidad} de hoy`}
            className="flex-1 min-w-0 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            onClick={reportar}
            disabled={saving || isNaN(num) || num <= 0}
            className="shrink-0 rounded-lg bg-brand-600 text-white px-3.5 py-2 text-sm font-semibold disabled:opacity-40 active:bg-brand-700 flex items-center gap-1"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cargar"}
          </button>
        </div>
      )}
      {!completa && incrFrac > 0 && (
        <p className="mt-1.5 text-2xs text-stone-500">
          {(tarea.pctAcumulado * 100).toFixed(0)}% + {(incrFrac * 100).toFixed(0)}% = <span className="font-bold text-brand-700">{(totalPreview * 100).toFixed(0)}%</span>
        </p>
      )}
    </div>
  );
}

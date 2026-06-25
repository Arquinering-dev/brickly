/**
 * CronogramaEditor — edición a mano del cronograma de una obra (LineaCronograma).
 * Matriz tarea × mes con % de ejecución. Guarda en PUT /api/obras/:id/cronograma.
 * Reemplaza el viejo modelo Planificacion (retirado en Fase 4).
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { apiFetch } from "../lib/api";
import { fmtDate, fmtPct } from "../lib/format";
import { cn } from "./../lib/cn";
import { Button } from "./ui/button";

interface MesCol { ym: string; fecha: string }
interface Fila {
  lineaId: string;
  itemNumero: string | null;
  rubro: string;
  descripcion: string;
  cantidad: number;
  pctPorMes: Record<string, number>;
}

export function CronogramaEditor({ obraId, onClose }: { obraId: string; onClose: (saved: boolean) => void }) {
  const [meses, setMeses] = useState<MesCol[]>([]);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/obras/${obraId}/cronograma/matriz`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { meses: MesCol[]; filas: Fila[] } | null) => {
        if (d) { setMeses(d.meses); setFilas(d.filas); }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [obraId]);

  const rubros = useMemo(() => {
    const m = new Map<string, Fila[]>();
    for (const f of filas) { const a = m.get(f.rubro) ?? []; a.push(f); m.set(f.rubro, a); }
    return [...m.entries()].map(([nombre, fs]) => ({ nombre, filas: fs }));
  }, [filas]);

  const setPct = useCallback((lineaId: string, ym: string, frac: number) => {
    setFilas((arr) => arr.map((f) => {
      if (f.lineaId !== lineaId) return f;
      const pm = { ...f.pctPorMes };
      if (frac > 0) pm[ym] = frac; else delete pm[ym];
      return { ...f, pctPorMes: pm };
    }));
  }, []);

  const distribuir = (lineaId: string) => setFilas((arr) => arr.map((f) => {
    if (f.lineaId !== lineaId) return f;
    const pm: Record<string, number> = {};
    for (const m of meses) pm[m.ym] = 1 / meses.length;
    return { ...f, pctPorMes: pm };
  }));
  const limpiar = (lineaId: string) => setFilas((arr) => arr.map((f) => f.lineaId === lineaId ? { ...f, pctPorMes: {} } : f));

  const guardar = async () => {
    setSaving(true);
    const res = await apiFetch(`/api/obras/${obraId}/cronograma`, {
      method: "PUT",
      body: JSON.stringify({ filas: filas.map((f) => ({ lineaId: f.lineaId, pctPorMes: f.pctPorMes })) }),
    });
    setSaving(false);
    if (res.ok) { toast.success("Cronograma guardado"); onClose(true); }
    else { const e = await res.json().catch(() => ({})); toast.error(e.error ?? "Error al guardar"); }
  };

  if (loading) return <div className="py-12 text-center text-stone-400 text-sm">Cargando matriz…</div>;
  if (meses.length === 0) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800">
          Esta obra no tiene meses de cronograma para editar. Importá el Resumen de Obra (con las columnas de meses en 1_Presupuesto) primero.
        </div>
        <Button variant="outline" size="sm" onClick={() => onClose(false)}>Volver</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-stone-500">
          Editá el % de ejecución por mes de cada tarea. Cada fila debería sumar ~100%.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onClose(false)} disabled={saving}>Cancelar</Button>
          <Button size="sm" onClick={guardar} disabled={saving}>{saving ? "Guardando…" : "Guardar cronograma"}</Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-stone-500 text-xs sticky left-0 bg-stone-50 min-w-[280px] z-10">Tarea</th>
                {meses.map((m) => (
                  <th key={m.ym} className="text-center px-1 py-2 font-medium text-stone-500 text-[10px] min-w-[58px]">{fmtDate(m.fecha, "month")}</th>
                ))}
                <th className="text-right px-2 py-2 font-medium text-stone-500 text-xs sticky right-0 bg-stone-50">Suma</th>
                <th className="px-1 py-2" />
              </tr>
            </thead>
            <tbody>
              {rubros.map((r) => (
                <RubroBlock key={r.nombre} rubro={r.nombre} filas={r.filas} meses={meses} onSet={setPct} onDistribuir={distribuir} onLimpiar={limpiar} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RubroBlock({
  rubro, filas, meses, onSet, onDistribuir, onLimpiar,
}: {
  rubro: string;
  filas: Fila[];
  meses: MesCol[];
  onSet: (lineaId: string, ym: string, frac: number) => void;
  onDistribuir: (lineaId: string) => void;
  onLimpiar: (lineaId: string) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <tr className="bg-stone-100/70 border-y border-stone-200">
        <td colSpan={2 + meses.length + 2} className="px-3 py-2">
          <button onClick={() => setOpen(!open)} className="text-xs font-bold text-stone-800 uppercase flex items-center gap-2">
            {open ? "▼" : "▶"} {rubro} <span className="font-normal text-stone-500">({filas.length})</span>
          </button>
        </td>
      </tr>
      {open && filas.map((f) => {
        const suma = Object.values(f.pctPorMes).reduce((a, b) => a + b, 0);
        const sumaOk = Math.abs(suma - 1) < 0.005;
        const sumaVacia = suma < 0.0005;
        return (
          <tr key={f.lineaId} className="border-b border-stone-50 hover:bg-stone-50/50">
            <td className="px-3 py-2 sticky left-0 bg-white" title={f.descripcion}>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-stone-400 shrink-0">{f.itemNumero ?? ""}</span>
                <span className="text-xs text-stone-700 truncate max-w-[230px]">{f.descripcion}</span>
              </div>
            </td>
            {meses.map((m) => {
              const val = (f.pctPorMes[m.ym] ?? 0) * 100;
              return (
                <td key={m.ym} className="px-0.5 py-1 text-center">
                  <input
                    type="number"
                    value={val ? Number(val.toFixed(1)) : ""}
                    onChange={(e) => onSet(f.lineaId, m.ym, (parseFloat(e.target.value) || 0) / 100)}
                    placeholder="0"
                    className={cn("w-12 px-1 py-0.5 text-[11px] text-center rounded border focus:outline-none focus:ring-1 focus:ring-brand-400",
                      val > 0 ? "bg-brand-50 border-brand-200 text-brand-700 font-medium" : "border-stone-200 text-stone-400")}
                  />
                </td>
              );
            })}
            <td className={cn("px-2 py-2 text-right text-xs font-bold sticky right-0 bg-white",
              sumaVacia ? "text-stone-300" : sumaOk ? "text-emerald-600" : "text-red-500")}>
              {fmtPct(suma)}
            </td>
            <td className="px-1 py-1">
              <div className="flex flex-col gap-1">
                <button onClick={() => onDistribuir(f.lineaId)} title="Distribuir uniforme" className="text-[9px] px-1 py-0.5 border border-stone-200 rounded hover:bg-stone-100">≡</button>
                <button onClick={() => onLimpiar(f.lineaId)} title="Limpiar" className="text-[9px] px-1 py-0.5 border border-stone-200 rounded hover:bg-stone-100">×</button>
              </div>
            </td>
          </tr>
        );
      })}
    </>
  );
}

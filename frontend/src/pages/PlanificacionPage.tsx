import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "../lib/api";
import { useObras } from "../hooks/useObras";
import { Button } from "../components/ui/button";
import { Input, Label } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";

const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

interface PlanListItem {
  id: string;
  nombre: string;
  estado: string;
  fechaInicio: string;
  duracionMeses: number;
  obra: { id: string; nombre: string; codigo: string };
  _count: { filas: number };
  createdAt: string;
}

interface Fila {
  id?: string;
  lineaId: string | null;
  partidaId: string | null;
  itemNumero: string | null;
  rubro: string;
  descripcion: string;
  cantidad: number;
  pctPorMes: number[];
}

export default function PlanificacionPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  if (location.pathname.endsWith("/nueva")) return <PlanificacionEditor mode="new" />;
  if (id) return <PlanificacionEditor mode="edit" planId={id} />;
  return <PlanificacionLista />;
}

// ────────────────────────────────────────────────────────────────────────────────
function PlanificacionLista() {
  const navigate = useNavigate();
  const [items, setItems] = useState<PlanListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchList = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch("/api/planificacion");
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, []);
  useEffect(() => { fetchList(); }, [fetchList]);

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar planificación?")) return;
    await apiFetch(`/api/planificacion/${id}`, { method: "DELETE" });
    fetchList();
  };

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-950">Planificaciones</h1>
          <p className="text-sm text-gray-500">{items.length} planificaciones</p>
        </div>
        <button
          onClick={() => navigate("/catalogo/planificaciones/nueva")}
          className="px-5 py-2.5 bg-brand-500 text-white rounded-lg text-sm font-semibold hover:bg-brand-600 shadow-sm"
        >
          + Nueva planificación
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400 text-sm">Cargando…</div>
      ) : items.length === 0 ? (
        <div className="py-20 text-center text-gray-400 text-sm">
          Sin planificaciones. Creá una nueva para empezar.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate(`/catalogo/planificaciones/${p.id}`)}
              className="text-left bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-brand-300 transition-all p-5"
            >
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{p.obra.codigo}</p>
              <p className="text-base font-bold text-gray-900 mb-1">{p.obra.nombre}</p>
              <p className="text-sm text-gray-600 mb-4">{p.nombre}</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-gray-400">Duración</p>
                  <p className="font-medium text-gray-700">{p.duracionMeses} meses</p>
                </div>
                <div>
                  <p className="text-gray-400">Tareas</p>
                  <p className="font-medium text-gray-700">{p._count.filas}</p>
                </div>
                <div>
                  <p className="text-gray-400">Inicio</p>
                  <p className="font-medium text-gray-700">{new Date(p.fechaInicio).toLocaleDateString("es-AR", { month: "short", year: "2-digit" })}</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end">
                <span onClick={(e) => { e.stopPropagation(); eliminar(p.id); }}
                  className="text-xs text-red-400 hover:text-red-600 cursor-pointer">Eliminar</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
function PlanificacionEditor({ mode, planId }: { mode: "new" | "edit"; planId?: string }) {
  const navigate = useNavigate();
  const { obras } = useObras();
  const [obraId, setObraId] = useState("");
  const [nombre, setNombre] = useState("Planificación inicial");
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().slice(0, 10));
  const [duracionMeses, setDuracionMeses] = useState(12);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [obraNombre, setObraNombre] = useState("");
  const [obraCodigo, setObraCodigo] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(mode === "edit");
  const [presupuestosObra, setPresupuestosObra] = useState<{ id: string; nombre: string | null; tipo: string }[]>([]);
  const [fromHeaderId, setFromHeaderId] = useState<string>("");

  useEffect(() => {
    if (mode !== "edit" || !planId) return;
    setLoading(true);
    apiFetch(`/api/planificacion/${planId}`)
      .then((r) => r.json())
      .then((data) => {
        setObraId(data.obraId);
        setObraNombre(data.obra.nombre);
        setObraCodigo(data.obra.codigo);
        setNombre(data.nombre);
        setFechaInicio(new Date(data.fechaInicio).toISOString().slice(0, 10));
        setDuracionMeses(data.duracionMeses);
        setFilas(data.filas.map((f: Fila & { pctPorMes: number[] | string }) => ({
          ...f,
          cantidad: Number(f.cantidad),
          pctPorMes: Array.isArray(f.pctPorMes) ? f.pctPorMes : JSON.parse(f.pctPorMes as string),
        })));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [mode, planId]);

  useEffect(() => {
    if (!obraId || mode !== "new") return;
    apiFetch(`/api/presupuestos?obraId=${obraId}`)
      .then((r) => r.json())
      .then((list: { id: string; nombre: string | null; tipo: string }[]) => {
        setPresupuestosObra(list);
        const aprobado = list.find((p) => p.tipo === "APROBADO");
        if (aprobado) setFromHeaderId(aprobado.id);
      });
  }, [obraId, mode]);

  const crear = async () => {
    if (!obraId || !nombre || !fechaInicio || !duracionMeses) return;
    setCreating(true);
    const res = await apiFetch("/api/planificacion", {
      method: "POST",
      body: JSON.stringify({ obraId, nombre, fechaInicio, duracionMeses, fromHeaderId: fromHeaderId || undefined }),
    });
    setCreating(false);
    if (res.ok) {
      const data = await res.json();
      navigate(`/catalogo/planificaciones/${data.id}`);
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Error al crear");
    }
  };

  const guardarFilas = async () => {
    if (!planId) return;
    setSaving(true);
    await apiFetch(`/api/planificacion/${planId}`, {
      method: "PUT",
      body: JSON.stringify({ nombre, fechaInicio, duracionMeses, filas }),
    });
    setSaving(false);
  };

  if (loading) return <div className="p-8 text-gray-400">Cargando…</div>;

  if (mode === "new") {
    return (
      <div className="p-6 lg:p-8 max-w-2xl mx-auto">
        <button onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 transition-colors mb-3">
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
        <h1 className="text-2xl font-black text-stone-900 tracking-tight mb-6">Nueva planificación</h1>

        <Card className="p-6 space-y-5">
          <div>
            <Label>Obra *</Label>
            <Select value={obraId} onValueChange={setObraId}>
              <SelectTrigger>
                <SelectValue placeholder="— Seleccionar obra —" />
              </SelectTrigger>
              <SelectContent>
                {obras.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.codigo} · {o.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Nombre</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Fecha de inicio *</Label>
              <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
            </div>
            <div>
              <Label>Duración (meses) *</Label>
              <Input type="number" min={1} max={60} value={duracionMeses}
                onChange={(e) => setDuracionMeses(parseInt(e.target.value) || 12)} />
            </div>
          </div>

          {presupuestosObra.length > 0 && (
            <div>
              <Label>Pre-llenar desde presupuesto</Label>
              <Select value={fromHeaderId} onValueChange={setFromHeaderId}>
                <SelectTrigger>
                  <SelectValue placeholder="— No pre-llenar —" />
                </SelectTrigger>
                <SelectContent>
                  {presupuestosObra.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.tipo === "APROBADO" ? "⭐ " : "📝 "}{p.nombre ?? p.tipo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-stone-500 mt-1.5 flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Pre-llena las tareas desde el presupuesto seleccionado.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => navigate("/catalogo/planificaciones")}>Cancelar</Button>
            <Button onClick={crear} disabled={creating || !obraId}>
              {creating ? "Creando…" : "Crear y abrir editor"}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <PlanificacionMatriz
      obraNombre={obraNombre}
      obraCodigo={obraCodigo}
      nombre={nombre}
      setNombre={setNombre}
      fechaInicio={fechaInicio}
      duracionMeses={duracionMeses}
      filas={filas}
      setFilas={setFilas}
      onSave={guardarFilas}
      saving={saving}
      onBack={() => navigate("/catalogo/planificaciones")}
    />
  );
}

// ────────────────────────────────────────────────────────────────────────────────
function PlanificacionMatriz({
  obraNombre, obraCodigo, nombre, setNombre, fechaInicio, duracionMeses,
  filas, setFilas, onSave, saving, onBack,
}: {
  obraNombre: string;
  obraCodigo: string;
  nombre: string;
  setNombre: (s: string) => void;
  fechaInicio: string;
  duracionMeses: number;
  filas: Fila[];
  setFilas: React.Dispatch<React.SetStateAction<Fila[]>>;
  onSave: () => void;
  saving: boolean;
  onBack: () => void;
}) {
  const meses = useMemo(() => {
    const inicio = new Date(fechaInicio);
    return Array.from({ length: duracionMeses }, (_, i) => {
      const d = new Date(inicio);
      d.setMonth(d.getMonth() + i);
      return { ordinal: i, label: d.toLocaleDateString("es-AR", { month: "short", year: "2-digit" }) };
    });
  }, [fechaInicio, duracionMeses]);

  const rubros = useMemo(() => {
    const m = new Map<string, Fila[]>();
    for (const f of filas) {
      const arr = m.get(f.rubro) ?? [];
      arr.push(f);
      m.set(f.rubro, arr);
    }
    return [...m.entries()].map(([nombre, arr]) => ({ nombre, filas: arr }));
  }, [filas]);

  const updatePct = (filaIdx: number, mesIdx: number, value: number) => {
    setFilas((arr) => arr.map((f, i) => {
      if (i !== filaIdx) return f;
      const pct = [...f.pctPorMes];
      while (pct.length < duracionMeses) pct.push(0);
      pct[mesIdx] = value;
      return { ...f, pctPorMes: pct };
    }));
  };

  const distribuirUniforme = (filaIdx: number) => {
    setFilas((arr) => arr.map((f, i) => {
      if (i !== filaIdx) return f;
      return { ...f, pctPorMes: new Array(duracionMeses).fill(1 / duracionMeses) };
    }));
  };

  const limpiarFila = (filaIdx: number) => {
    setFilas((arr) => arr.map((f, i) =>
      i === filaIdx ? { ...f, pctPorMes: new Array(duracionMeses).fill(0) } : f
    ));
  };

  return (
    <div className="p-8 max-w-[1600px]">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-400 hover:text-gray-700 text-sm">← Planificaciones</button>
          <span className="text-gray-300">/</span>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{obraNombre}</h1>
            <p className="text-xs text-gray-500 font-mono">{obraCodigo}</p>
          </div>
        </div>
        <button onClick={onSave} disabled={saving}
          className="px-5 py-2 bg-brand-500 text-white rounded-lg text-sm font-semibold hover:bg-brand-600 disabled:opacity-50">
          {saving ? "Guardando…" : "Guardar planificación"}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-4">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)}
          className="w-full border-0 border-b border-transparent hover:border-gray-200 focus:border-brand-400 px-0 py-1 text-lg font-semibold focus:outline-none mb-3" />
        <p className="text-xs text-gray-500">
          {duracionMeses} meses · {filas.length} tareas · arranca {new Date(fechaInicio).toLocaleDateString("es-AR")}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-500 text-xs sticky left-0 bg-gray-50 min-w-[300px] z-10">
                  Tarea
                </th>
                <th className="text-right px-2 py-2 font-medium text-gray-500 text-xs">Cant</th>
                {meses.map((m) => (
                  <th key={m.ordinal} className="text-center px-1 py-2 font-medium text-gray-500 text-[10px] min-w-[60px]">
                    {m.label}
                  </th>
                ))}
                <th className="text-right px-2 py-2 font-medium text-gray-500 text-xs sticky right-0 bg-gray-50">Suma</th>
                <th className="px-1 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rubros.map((r) => (
                <RubroBlock
                  key={r.nombre}
                  rubro={r.nombre}
                  filas={r.filas}
                  todasFilas={filas}
                  meses={meses}
                  duracionMeses={duracionMeses}
                  onUpdatePct={updatePct}
                  onDistribuir={distribuirUniforme}
                  onLimpiar={limpiarFila}
                />
              ))}
            </tbody>
          </table>
        </div>
        {filas.length === 0 && (
          <div className="py-12 text-center text-gray-400 text-sm">
            Esta planificación no tiene tareas. Asegurate de tener un presupuesto cargado para esta obra.
          </div>
        )}
      </div>
    </div>
  );
}

function RubroBlock({
  rubro, filas, todasFilas, meses, duracionMeses, onUpdatePct, onDistribuir, onLimpiar,
}: {
  rubro: string;
  filas: Fila[];
  todasFilas: Fila[];
  meses: { ordinal: number; label: string }[];
  duracionMeses: number;
  onUpdatePct: (filaIdx: number, mesIdx: number, v: number) => void;
  onDistribuir: (filaIdx: number) => void;
  onLimpiar: (filaIdx: number) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <tr className="bg-gradient-to-r from-gray-100 to-gray-50 border-y border-gray-200">
        <td colSpan={2 + meses.length + 2} className="px-3 py-2">
          <button onClick={() => setOpen(!open)} className="text-xs font-bold text-gray-800 uppercase flex items-center gap-2">
            {open ? "▼" : "▶"} {rubro} <span className="font-normal text-gray-500">({filas.length})</span>
          </button>
        </td>
      </tr>
      {open && filas.map((f) => {
        const idx = todasFilas.indexOf(f);
        const suma = f.pctPorMes.reduce((a, b) => a + b, 0);
        const sumaOk = Math.abs(suma - 1) < 0.001;
        const sumaVacia = Math.abs(suma) < 0.001;
        return (
          <tr key={f.id ?? idx} className="border-b border-gray-50 hover:bg-gray-50/50">
            <td className="px-3 py-2 sticky left-0 bg-white" title={f.descripcion}>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-gray-400 shrink-0">{f.itemNumero ?? ""}</span>
                <span className="text-xs text-gray-700 truncate max-w-[250px]">{f.descripcion}</span>
              </div>
            </td>
            <td className="px-2 py-2 text-right text-[11px] text-gray-500">{Number(f.cantidad).toFixed(0)}</td>
            {meses.map((m) => {
              const val = (f.pctPorMes[m.ordinal] ?? 0) * 100;
              return (
                <td key={m.ordinal} className="px-0.5 py-1 text-center">
                  <input
                    type="number"
                    value={val ? val.toFixed(1) : ""}
                    onChange={(e) => onUpdatePct(idx, m.ordinal, (parseFloat(e.target.value) || 0) / 100)}
                    placeholder="0"
                    className={`w-12 px-1 py-0.5 text-[11px] text-center rounded border ${
                      val > 0 ? "bg-brand-50 border-brand-200 text-brand-700 font-medium" : "border-gray-200 text-gray-400"
                    } focus:outline-none focus:ring-1 focus:ring-brand-400`}
                  />
                </td>
              );
            })}
            <td className={`px-2 py-2 text-right text-xs font-bold sticky right-0 bg-white ${
              sumaVacia ? "text-gray-300" : sumaOk ? "text-emerald-600" : "text-red-500"
            }`}>
              {fmtPct(suma)}
            </td>
            <td className="px-1 py-1">
              <div className="flex flex-col gap-1">
                <button onClick={() => onDistribuir(idx)} title="Distribuir uniforme"
                  className="text-[9px] px-1 py-0.5 border border-gray-200 rounded hover:bg-gray-100">≡</button>
                <button onClick={() => onLimpiar(idx)} title="Limpiar"
                  className="text-[9px] px-1 py-0.5 border border-gray-200 rounded hover:bg-gray-100">×</button>
              </div>
            </td>
          </tr>
        );
      })}
      {void duracionMeses}
    </>
  );
}

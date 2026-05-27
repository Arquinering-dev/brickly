import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useObras } from "../hooks/useObras";

// ────────────────────────────────────────────────────────────────────────────────
// Helpers
const fmtMoney = (n: number) =>
  n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const fmtNum = (n: number, dec = 2) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });

// ────────────────────────────────────────────────────────────────────────────────
// Tipos
interface PresupuestoListItem {
  id: string;
  obra: { id: string; nombre: string; codigo: string; estado: string };
  tipo: "GENERADOR" | "APROBADO";
  nombre: string | null;
  version: string | null;
  estado: string;
  mesCac: string;
  cacValor: number;
  coefGGBB: number | null;
  fecha: string;
  fechaInicio: string | null;
  lineasCount: number;
  rubrosCount: number;
  totalCD: number;
  totalPV: number;
  createdAt: string;
}

// ────────────────────────────────────────────────────────────────────────────────
// Componente raíz
export default function PresupuestoPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const isNew = location.pathname.endsWith("/nuevo");

  if (isNew) return <PresupuestoEditor mode="new" />;
  if (id) return <PresupuestoEditor mode="edit" headerId={id} />;
  return <PresupuestoLista />;
}

// ────────────────────────────────────────────────────────────────────────────────
// LISTA
function PresupuestoLista() {
  const navigate = useNavigate();
  const [items, setItems] = useState<PresupuestoListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTipo, setFilterTipo] = useState<"" | "GENERADOR" | "APROBADO">("");

  const fetchList = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (filterTipo) qs.set("tipo", filterTipo);
    const res = await apiFetch(`/api/presupuestos?${qs}`);
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, [filterTipo]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar este presupuesto? Esta acción es irreversible.")) return;
    await apiFetch(`/api/presupuestos/${id}`, { method: "DELETE" });
    fetchList();
  };

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-950">Presupuestos</h1>
          <p className="text-sm text-gray-500">{items.length} presupuestos</p>
        </div>
        <button
          onClick={() => navigate("/catalogo/presupuestos/nuevo")}
          className="px-5 py-2.5 bg-brand-500 text-white rounded-lg text-sm font-semibold hover:bg-brand-600 shadow-sm"
        >
          + Nuevo presupuesto
        </button>
      </div>

      <div className="flex gap-2 mb-5">
        {([ { val: "" as const, label: "Todos" },
            { val: "GENERADOR" as const, label: "Generador" },
            { val: "APROBADO" as const, label: "Aprobado" },
        ] as const).map((f) => (
          <button
            key={f.val || "all"}
            onClick={() => setFilterTipo(f.val)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              filterTipo === f.val ? "bg-brand-500 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400 text-sm">Cargando…</div>
      ) : items.length === 0 ? (
        <div className="py-20 text-center text-gray-400 text-sm">
          Sin presupuestos todavía. Creá uno nuevo para empezar.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate(`/catalogo/presupuestos/${p.id}`)}
              className="text-left bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-brand-300 transition-all p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  p.tipo === "APROBADO"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-blue-100 text-blue-700"
                }`}>
                  {p.tipo === "APROBADO" ? "APROBADO" : "GENERADOR"}
                </span>
                <span className="text-xs text-gray-400 font-mono">{p.obra.codigo}</span>
              </div>
              <p className="text-base font-bold text-gray-900 mb-1 truncate">{p.obra.nombre}</p>
              <p className="text-xs text-gray-500 mb-4">{p.nombre || "—"}{p.version ? ` · v${p.version}` : ""}</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-gray-400">Costo directo</p>
                  <p className="font-bold text-gray-800">{fmtMoney(p.totalCD)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Precio venta</p>
                  <p className="font-bold text-gray-800">{p.totalPV > 0 ? fmtMoney(p.totalPV) : "—"}</p>
                </div>
                <div>
                  <p className="text-gray-400">Tareas</p>
                  <p className="font-medium text-gray-700">{p.lineasCount}</p>
                </div>
                <div>
                  <p className="text-gray-400">Rubros</p>
                  <p className="font-medium text-gray-700">{p.rubrosCount}</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end">
                <span
                  onClick={(e) => { e.stopPropagation(); eliminar(p.id); }}
                  className="text-xs text-red-400 hover:text-red-600 cursor-pointer"
                >
                  Eliminar
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// EDITOR (nuevo o existente)
function PresupuestoEditor({ mode, headerId }: { mode: "new" | "edit"; headerId?: string }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"datos" | "lineas">("datos");
  const [tipo, setTipo] = useState<"GENERADOR" | "APROBADO">("GENERADOR");
  const [headerNombre, setHeaderNombre] = useState("");
  const [headerVersion, setHeaderVersion] = useState("");
  const [obraId, setObraId] = useState<string>("");
  const [obraNombre, setObraNombre] = useState("");
  const [obraCodigo, setObraCodigo] = useState("");
  const [existingHeader, setExistingHeader] = useState<PresupuestoListItem | null>(null);
  const [loading, setLoading] = useState(mode === "edit");

  useEffect(() => {
    if (mode !== "edit" || !headerId) return;
    setLoading(true);
    apiFetch(`/api/presupuestos/${headerId}`)
      .then((r) => r.json())
      .then((data) => {
        setTipo(data.tipo);
        setHeaderNombre(data.nombre ?? "");
        setHeaderVersion(data.version ?? "");
        setObraId(data.obraId);
        setObraNombre(data.obra.nombre);
        setObraCodigo(data.obra.codigo);
        setExistingHeader(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [mode, headerId]);

  if (loading) return <div className="p-8 text-gray-400">Cargando…</div>;

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/catalogo/presupuestos")} className="text-gray-400 hover:text-gray-700 text-sm">
          ← Presupuestos
        </button>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900">
          {mode === "new" ? "Nuevo presupuesto" : `${obraNombre || "Presupuesto"}${headerVersion ? ` · v${headerVersion}` : ""}`}
        </h1>
      </div>

      <div className="flex gap-1 border-b border-gray-200 mb-6">
        <TabBtn active={activeTab === "datos"} onClick={() => setActiveTab("datos")}>
          Datos
        </TabBtn>
        <TabBtn active={activeTab === "lineas"} onClick={() => setActiveTab("lineas")}>
          Líneas {existingHeader?.lineasCount ? `(${existingHeader.lineasCount})` : ""}
        </TabBtn>
      </div>

      {activeTab === "datos" && (
        <DatosTab
          mode={mode}
          headerId={headerId}
          tipo={tipo}
          setTipo={setTipo}
          nombre={headerNombre}
          setNombre={setHeaderNombre}
          version={headerVersion}
          setVersion={setHeaderVersion}
          obraId={obraId}
          setObraId={setObraId}
          obraNombre={obraNombre}
          setObraNombre={setObraNombre}
          obraCodigo={obraCodigo}
          setObraCodigo={setObraCodigo}
          onCreated={(id) => navigate(`/catalogo/presupuestos/${id}`)}
        />
      )}

      {activeTab === "lineas" && mode === "edit" && headerId && (
        <LineasTab headerId={headerId} />
      )}
      {activeTab === "lineas" && mode === "new" && (
        <div className="bg-gray-50 rounded-2xl p-12 text-center text-gray-400 text-sm">
          Primero guardá los datos del presupuesto.
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
        active ? "border-brand-500 text-brand-600" : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >
      {children}
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// TAB: Datos (editar/crear header)
function DatosTab({
  mode, headerId, tipo, setTipo, nombre, setNombre, version, setVersion,
  obraId, setObraId, obraNombre, setObraNombre, obraCodigo, setObraCodigo,
  onCreated,
}: {
  mode: "new" | "edit";
  headerId?: string;
  tipo: "GENERADOR" | "APROBADO";
  setTipo: (t: "GENERADOR" | "APROBADO") => void;
  nombre: string;
  setNombre: (s: string) => void;
  version: string;
  setVersion: (s: string) => void;
  obraId: string;
  setObraId: (s: string) => void;
  obraNombre: string;
  setObraNombre: (s: string) => void;
  obraCodigo: string;
  setObraCodigo: (s: string) => void;
  onCreated?: (headerId: string) => void;
}) {
  const { obras } = useObras();
  const [saving, setSaving] = useState(false);

  const guardar = async () => {
    setSaving(true);
    if (mode === "edit" && headerId) {
      await apiFetch(`/api/presupuestos/${headerId}`, {
        method: "PUT",
        body: JSON.stringify({ nombre, version }),
      });
    } else {
      // Crear presupuesto vacío
      const res = await apiFetch("/api/presupuestos", {
        method: "POST",
        body: JSON.stringify({ tipo, obraId: obraId || undefined, obraNombre, obraCodigo, nombre, version }),
      });
      if (res.ok) {
        const data = await res.json();
        onCreated?.(data.id ?? data.header?.id);
      }
    }
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Tipo</label>
        <div className="flex gap-2">
          {(["GENERADOR", "APROBADO"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTipo(t)}
              disabled={mode === "edit"}
              className={`px-4 py-2 text-sm rounded-lg font-medium ${
                tipo === t ? "bg-brand-500 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"
              } disabled:opacity-60`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Nombre</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)}
            placeholder="ej: Presupuesto inicial obra civil"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Versión</label>
          <input value={version} onChange={(e) => setVersion(e.target.value)}
            placeholder="ej: 01"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Obra</label>
        {mode === "edit" ? (
          <p className="text-sm text-gray-700">{obraNombre} <span className="text-gray-400 font-mono">({obraCodigo})</span></p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select value={obraId} onChange={(e) => setObraId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
              <option value="">— Crear nueva —</option>
              {obras.map((o) => <option key={o.id} value={o.id}>{o.codigo} · {o.nombre}</option>)}
            </select>
            {!obraId && (
              <>
                <input value={obraNombre} onChange={(e) => setObraNombre(e.target.value)} placeholder="Nombre obra"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                <input value={obraCodigo} onChange={(e) => setObraCodigo(e.target.value)} placeholder="Código obra"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button onClick={guardar} disabled={saving}
          className="px-5 py-2 bg-brand-500 text-white rounded-lg text-sm font-semibold hover:bg-brand-600 disabled:opacity-50">
          {saving ? "Guardando…" : mode === "new" ? "Crear presupuesto" : "Guardar"}
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// TAB: Líneas (vista del presupuesto guardado)
interface LineaDB {
  id: string;
  itemNumero: string | null;
  rubro: string;
  cantidad: string;
  precioUnitarioSnapshot: string;
  precioVenta: string | null;
  partidaId: string | null;
  descripcionLibre: string | null;
  partida: { id: string; codigo: string; descripcion: string; unidad: string; scope: string } | null;
  matUd: string | null;
  moUd: string | null;
  eqUd: string | null;
}

function LineasTab({ headerId }: { headerId: string }) {
  const [lineas, setLineas] = useState<LineaDB[]>([]);
  const [tipo, setTipo] = useState<"GENERADOR" | "APROBADO">("GENERADOR");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/presupuestos/${headerId}`)
      .then((r) => r.json())
      .then((data) => { setLineas(data.lineas); setTipo(data.tipo); setLoading(false); });
  }, [headerId]);

  const rubros = useMemo(() => {
    const m = new Map<string, { total: number; lineas: LineaDB[] }>();
    for (const l of lineas) {
      const r = l.rubro || "GENERAL";
      const g = m.get(r) ?? { total: 0, lineas: [] };
      g.lineas.push(l);
      g.total += Number(l.cantidad) * Number(l.precioUnitarioSnapshot);
      m.set(r, g);
    }
    return [...m.entries()].map(([nombre, v]) => ({ nombre, ...v }));
  }, [lineas]);

  const totalCD = rubros.reduce((s, r) => s + r.total, 0);
  const totalPV = lineas.reduce((s, l) => s + Number(l.cantidad) * Number(l.precioVenta ?? 0), 0);

  if (loading) return <div className="text-gray-400 text-sm">Cargando líneas…</div>;

  if (lineas.length === 0) return (
    <div className="py-20 text-center text-gray-400 text-sm">
      Este presupuesto no tiene líneas todavía.
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 text-white rounded-2xl p-5 shadow-sm grid grid-cols-3 gap-6">
        <div>
          <p className="text-xs uppercase text-gray-400 mb-1">Tareas</p>
          <p className="text-2xl font-black">{lineas.length}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-gray-400 mb-1">Costo directo</p>
          <p className="text-2xl font-black">{fmtMoney(totalCD)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-gray-400 mb-1">Precio venta</p>
          <p className="text-2xl font-black">{tipo === "APROBADO" ? fmtMoney(totalPV) : "—"}</p>
        </div>
      </div>

      {rubros.map((r) => (
        <div key={r.nombre} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-800 text-sm uppercase">{r.nombre}</h3>
            <span className="text-sm font-semibold text-gray-700">{fmtMoney(r.total)}</span>
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500">
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-2 font-medium">Item</th>
                <th className="text-left px-4 py-2 font-medium">Partida</th>
                <th className="text-left px-4 py-2 font-medium">Origen</th>
                <th className="text-right px-4 py-2 font-medium">Cant</th>
                <th className="text-right px-4 py-2 font-medium">P. Unit</th>
                <th className="text-right px-4 py-2 font-medium">Total</th>
                {tipo === "APROBADO" && <th className="text-right px-4 py-2 font-medium">P. Venta</th>}
              </tr>
            </thead>
            <tbody>
              {r.lineas.map((l) => (
                <tr key={l.id} className="border-b border-gray-50">
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">{l.itemNumero}</td>
                  <td className="px-4 py-2 text-gray-800">
                    {l.partida?.descripcion ?? l.descripcionLibre ?? "—"}
                    {l.partida && <span className="ml-2 text-xs font-mono text-gray-400">{l.partida.codigo}</span>}
                  </td>
                  <td className="px-4 py-2">
                    {l.partida?.scope === "OBRA" ? (
                      <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded">Obra</span>
                    ) : l.partida?.scope === "APU" ? (
                      <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">APU</span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right text-xs">{fmtNum(Number(l.cantidad), 2)} {l.partida?.unidad ?? ""}</td>
                  <td className="px-4 py-2 text-right text-xs">{fmtMoney(Number(l.precioUnitarioSnapshot))}</td>
                  <td className="px-4 py-2 text-right font-medium">
                    {fmtMoney(Number(l.cantidad) * Number(l.precioUnitarioSnapshot))}
                  </td>
                  {tipo === "APROBADO" && (
                    <td className="px-4 py-2 text-right text-xs text-emerald-700">
                      {l.precioVenta ? fmtMoney(Number(l.precioVenta) * Number(l.cantidad)) : "—"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

interface Insumo {
  id: string;
  codigo: string;
  descripcion: string;
  tipo: "MATERIAL" | "MANO_DE_OBRA" | "EQUIPO" | "SUBCONTRATO";
  unidad: string;
  precioReferencia: number;
}

interface Composicion {
  id: string;
  insumoId: string;
  cantidadPorUnidad: number;
  pctDesperdicio: number;
  secuencia: number;
  insumo: Insumo;
}

interface Partida {
  id: string;
  codigo: string;
  descripcion: string;
  rubro: string;
  unidad: string;
  rendimiento: number | null;
  tipo: "APU" | "SUBCONTRATO" | "COTIZACION_DIRECTA";
  activa: boolean;
  composiciones: Composicion[];
}

type Tab = "MATERIAL" | "MANO_DE_OBRA" | "EQUIPO" | "SUBCONTRATO";

const TAB_LABELS: Record<Tab, string> = {
  MATERIAL: "Materiales",
  MANO_DE_OBRA: "Mano de Obra",
  EQUIPO: "Equipos",
  SUBCONTRATO: "Subcontratos",
};

function fmt(n: number, decimals = 4) {
  return Number(n).toLocaleString("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function AddInsumoModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (insumoId: string, cantidadPorUnidad: number, pctDesperdicio: number) => void;
}) {
  const [search, setSearch] = useState("");
  const [tipo, setTipo] = useState<Tab>("MATERIAL");
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [selected, setSelected] = useState<Insumo | null>(null);
  const [cantidad, setCantidad] = useState("1");
  const [pct, setPct] = useState("0");

  useEffect(() => {
    const params = new URLSearchParams({ tipo });
    if (search) params.set("search", search);
    fetch(`/api/insumos?${params}`)
      .then((r) => r.json())
      .then(setInsumos)
      .catch(() => {});
  }, [search, tipo]);

  const handleAdd = () => {
    if (!selected) return;
    onAdd(selected.id, parseFloat(cantidad) || 0, (parseFloat(pct) || 0) / 100);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Agregar insumo</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="flex gap-1 mb-3">
          {(["MATERIAL", "MANO_DE_OBRA", "EQUIPO", "SUBCONTRATO"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTipo(t); setSelected(null); }}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${tipo === t ? "bg-brand-500 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Buscar…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-brand-400"
        />

        <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg mb-4">
          {insumos.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">Sin resultados</p>
          ) : (
            insumos.map((ins) => (
              <button
                key={ins.id}
                onClick={() => setSelected(ins)}
                className={`w-full text-left px-3 py-2 text-sm border-b border-gray-50 hover:bg-brand-50 transition-colors ${selected?.id === ins.id ? "bg-brand-50 font-medium" : ""}`}
              >
                <span className="font-mono text-xs text-gray-400 mr-2">{ins.codigo}</span>
                {ins.descripcion}
                <span className="text-xs text-gray-400 ml-1">({ins.unidad})</span>
              </button>
            ))
          )}
        </div>

        {selected && (
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <p className="text-xs font-medium text-gray-700 mb-2">{selected.descripcion}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cantidad/ud</label>
                <input
                  type="number"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">% Desperdicio</label>
                <input
                  type="number"
                  value={pct}
                  onChange={(e) => setPct(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={handleAdd}
            disabled={!selected}
            className="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-40"
          >
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
}

function ComposicionTable({
  tab,
  rows,
  rendimiento,
  onUpdate,
  onDelete,
  onAddClick,
}: {
  tab: Tab;
  rows: Composicion[];
  rendimiento: number | null;
  onUpdate: (id: string, cant: number, pct: number) => void;
  onDelete: (id: string) => void;
  onAddClick: () => void;
}) {
  const filtered = rows.filter((r) => r.insumo.tipo === tab);
  const [editId, setEditId] = useState<string | null>(null);
  const [editCant, setEditCant] = useState("");
  const [editPct, setEditPct] = useState("");

  const startEdit = (c: Composicion) => {
    setEditId(c.id);
    setEditCant(String(c.cantidadPorUnidad));
    setEditPct(String(Number(c.pctDesperdicio) * 100));
  };
  const saveEdit = () => {
    if (!editId) return;
    onUpdate(editId, parseFloat(editCant) || 0, (parseFloat(editPct) || 0) / 100);
    setEditId(null);
  };

  return (
    <div>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-3 py-2 font-medium text-gray-500">Código</th>
              <th className="text-left px-3 py-2 font-medium text-gray-500">Descripción</th>
              <th className="text-right px-3 py-2 font-medium text-gray-500">Cant/ud</th>
              <th className="text-right px-3 py-2 font-medium text-gray-500">% Desp.</th>
              <th className="text-right px-3 py-2 font-medium text-gray-500">Precio ref.</th>
              <th className="text-right px-3 py-2 font-medium text-gray-500">Costo/ud</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-gray-400 text-center text-xs">Sin insumos</td>
              </tr>
            ) : (
              filtered.map((c) => {
                const isEditing = editId === c.id;
                const rend = rendimiento ? Number(rendimiento) : 0;
                const usaRend = c.insumo.tipo === "MANO_DE_OBRA" || c.insumo.tipo === "EQUIPO";
                const cantUd = usaRend
                  ? (rend > 0 ? Number(c.cantidadPorUnidad) / rend : Number(c.cantidadPorUnidad))
                  : Number(c.cantidadPorUnidad) * (1 + Number(c.pctDesperdicio));
                const costoUd = cantUd * Number(c.insumo.precioReferencia);
                return (
                  <tr key={c.id} className="border-b border-gray-50">
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">{c.insumo.codigo}</td>
                    <td className="px-3 py-2 text-gray-700">{c.insumo.descripcion}</td>
                    <td className="px-3 py-2 text-right">
                      {isEditing ? (
                        <input type="number" value={editCant} onChange={(e) => setEditCant(e.target.value)}
                          className="w-24 border border-gray-300 rounded px-2 py-0.5 text-right text-xs" />
                      ) : fmt(c.cantidadPorUnidad)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {isEditing ? (
                        <input type="number" value={editPct} onChange={(e) => setEditPct(e.target.value)}
                          className="w-20 border border-gray-300 rounded px-2 py-0.5 text-right text-xs" />
                      ) : `${(Number(c.pctDesperdicio) * 100).toFixed(1)}%`}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-500 text-xs">
                      ${Number(c.insumo.precioReferencia).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-gray-700">
                      ${costoUd.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 justify-end">
                        {isEditing ? (
                          <>
                            <button onClick={saveEdit} className="px-2 py-1 text-xs bg-brand-500 text-white rounded hover:bg-brand-600">Guardar</button>
                            <button onClick={() => setEditId(null)} className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50">Cancelar</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(c)} className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50">Editar</button>
                            <button onClick={() => onDelete(c.id)} className="px-2 py-1 text-xs border border-red-100 text-red-500 rounded hover:bg-red-50">✕</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <button
        onClick={onAddClick}
        className="mt-2 px-3 py-1.5 text-xs border border-dashed border-brand-400 text-brand-600 rounded-lg hover:bg-brand-50 transition-colors"
      >
        + Agregar insumo
      </button>
    </div>
  );
}

export default function PartidaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [partida, setPartida] = useState<Partida | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Partida>>({});
  const [activeTab, setActiveTab] = useState<Tab>("MATERIAL");
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchPartida = async () => {
    setLoading(true);
    const res = await fetch(`/api/partidas/${id}`);
    const data: Partida = await res.json();
    setPartida(data);
    setForm({ descripcion: data.descripcion, rubro: data.rubro, unidad: data.unidad, rendimiento: data.rendimiento, tipo: data.tipo });
    setLoading(false);
  };

  useEffect(() => { fetchPartida(); }, [id]);

  const savePartida = async () => {
    if (!partida) return;
    setSaving(true);
    await fetch(`/api/partidas/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    await fetchPartida();
  };

  const updateComposicion = async (compId: string, cant: number, pct: number) => {
    await fetch(`/api/partidas/${id}/composicion/${compId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cantidadPorUnidad: cant, pctDesperdicio: pct }),
    });
    fetchPartida();
  };

  const deleteComposicion = async (compId: string) => {
    await fetch(`/api/partidas/${id}/composicion/${compId}`, { method: "DELETE" });
    fetchPartida();
  };

  const addInsumo = async (insumoId: string, cantidadPorUnidad: number, pctDesperdicio: number) => {
    await fetch(`/api/partidas/${id}/composicion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ insumoId, cantidadPorUnidad, pctDesperdicio }),
    });
    setShowAddModal(false);
    fetchPartida();
  };

  if (loading) return <div className="p-8 text-gray-400">Cargando…</div>;
  if (!partida) return <div className="p-8 text-red-500">Partida no encontrada</div>;

  const input = (label: string, key: keyof typeof form, type: "text" | "number" | "select" = "text") => (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      {type === "select" ? (
        <select
          value={String(form[key] ?? "")}
          onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        >
          <option value="APU">APU</option>
          <option value="SUBCONTRATO">Subcontrato</option>
          <option value="COTIZACION_DIRECTA">Cotización directa</option>
        </select>
      ) : (
        <input
          type={type}
          value={String(form[key] ?? "")}
          onChange={(e) =>
            setForm((p) => ({ ...p, [key]: type === "number" ? parseFloat(e.target.value) || null : e.target.value }))
          }
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
      )}
    </div>
  );

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/partidas")} className="text-gray-400 hover:text-gray-700 text-sm">
          ← Partidas
        </button>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900">{partida.codigo} — {partida.descripcion}</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="font-semibold text-gray-700 mb-4">Datos generales</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Código</label>
            <input
              type="text"
              value={partida.codigo}
              readOnly
              className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500"
            />
          </div>
          {input("Descripción", "descripcion")}
          {input("Rubro", "rubro")}
          {input("Unidad", "unidad")}
          {input("Rendimiento", "rendimiento", "number")}
          {input("Tipo", "tipo", "select")}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={savePartida}
            disabled={saving}
            className="px-5 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>

      {form.tipo === "APU" && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-700 mb-4">Composición</h2>
          <div className="flex gap-1 border-b border-gray-200 mb-4">
            {(["MATERIAL", "MANO_DE_OBRA", "EQUIPO", "SUBCONTRATO"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  activeTab === t ? "border-brand-500 text-brand-600" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {TAB_LABELS[t]} ({partida.composiciones.filter((c) => c.insumo.tipo === t).length})
              </button>
            ))}
          </div>
          <ComposicionTable
            tab={activeTab}
            rows={partida.composiciones}
            rendimiento={partida.rendimiento}
            onUpdate={updateComposicion}
            onDelete={deleteComposicion}
            onAddClick={() => setShowAddModal(true)}
          />
        </div>
      )}

      {showAddModal && (
        <AddInsumoModal
          onClose={() => setShowAddModal(false)}
          onAdd={addInsumo}
        />
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

interface Insumo {
  id: string;
  codigo: string;
  descripcion: string;
  unidad: string;
}

interface Composicion {
  id: string;
  tipo: "MATERIAL" | "MANO_DE_OBRA" | "EQUIPO";
  insumoId: string;
  cantidadPorUnidad: number;
  pctDesperdicio: number;
  secuencia: number;
  material?: Insumo;
  manoDeObra?: Insumo;
  equipo?: Insumo;
}

interface Partida {
  id: string;
  codigo: string;
  rubro: string;
  descripcion: string;
  unidad: string;
  rendimiento: number;
  pctDesperdicioConsumibles: number;
  pctDesperdicioGeneral: number;
  gradoDificultad: number;
  matUnitario: number;
  moUnitario: number;
  eqUnitario: number;
  cdUnitario: number;
  apuId: string;
  composiciones: Composicion[];
}

interface EditingComp {
  id: string;
  cantidadPorUnidad: string;
  pctDesperdicio: string;
}

function getInsumoInfo(c: Composicion): { codigo: string; descripcion: string } {
  const raw = c.material ?? c.manoDeObra ?? c.equipo;
  return { codigo: raw?.codigo ?? "—", descripcion: raw?.descripcion ?? "—" };
}

function ComposicionTable({
  title,
  tipo,
  rows,
  onUpdate,
  onDelete,
}: {
  title: string;
  tipo: "MATERIAL" | "MANO_DE_OBRA" | "EQUIPO";
  rows: Composicion[];
  onUpdate: (id: string, cant: string, pct: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState<EditingComp | null>(null);
  const filtered = rows.filter((r) => r.tipo === tipo);

  const startEdit = (c: Composicion) =>
    setEditing({
      id: c.id,
      cantidadPorUnidad: String(c.cantidadPorUnidad),
      pctDesperdicio: String(c.pctDesperdicio),
    });

  const saveEdit = () => {
    if (!editing) return;
    onUpdate(editing.id, editing.cantidadPorUnidad, editing.pctDesperdicio);
    setEditing(null);
  };

  return (
    <div className="mb-6">
      <h3 className="font-semibold text-gray-700 mb-2 text-sm">{title}</h3>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-3 py-2 font-medium text-gray-500">Código</th>
              <th className="text-left px-3 py-2 font-medium text-gray-500">Descripción</th>
              <th className="text-right px-3 py-2 font-medium text-gray-500">Cantidad/Ud</th>
              <th className="text-right px-3 py-2 font-medium text-gray-500">% Desp.</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-gray-400 text-center text-xs">
                  Sin insumos
                </td>
              </tr>
            ) : (
              filtered.map((c) => {
                const info = getInsumoInfo(c);
                const isEditing = editing?.id === c.id;
                return (
                  <tr key={c.id} className="border-b border-gray-50">
                    <td className="px-3 py-2 font-mono text-xs">{info.codigo}</td>
                    <td className="px-3 py-2 text-gray-700">{info.descripcion}</td>
                    <td className="px-3 py-2 text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editing.cantidadPorUnidad}
                          onChange={(e) =>
                            setEditing((prev) =>
                              prev ? { ...prev, cantidadPorUnidad: e.target.value } : null
                            )
                          }
                          className="w-24 border border-gray-300 rounded px-2 py-1 text-right text-xs"
                        />
                      ) : (
                        Number(c.cantidadPorUnidad).toFixed(4)
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editing.pctDesperdicio}
                          onChange={(e) =>
                            setEditing((prev) =>
                              prev ? { ...prev, pctDesperdicio: e.target.value } : null
                            )
                          }
                          className="w-20 border border-gray-300 rounded px-2 py-1 text-right text-xs"
                        />
                      ) : (
                        `${Number(c.pctDesperdicio).toFixed(1)}%`
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 justify-end">
                        {isEditing ? (
                          <>
                            <button
                              onClick={saveEdit}
                              className="px-2 py-1 text-xs bg-brand-500 text-white rounded hover:bg-brand-600"
                            >
                              Guardar
                            </button>
                            <button
                              onClick={() => setEditing(null)}
                              className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(c)}
                              className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => onDelete(c.id)}
                              className="px-2 py-1 text-xs border border-red-100 text-red-500 rounded hover:bg-red-50"
                            >
                              ✕
                            </button>
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

  const fetchPartida = async () => {
    setLoading(true);
    const res = await fetch(`/api/partidas/${id}`);
    const data: Partida = await res.json();
    setPartida(data);
    setForm({ ...data });
    setLoading(false);
  };

  useEffect(() => {
    fetchPartida();
  }, [id]);

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

  const updateComposicion = async (compId: string, cantidadPorUnidad: string, pctDesperdicio: string) => {
    await fetch(`/api/partidas/${id}/composicion/${compId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cantidadPorUnidad: parseFloat(cantidadPorUnidad),
        pctDesperdicio: parseFloat(pctDesperdicio),
      }),
    });
    fetchPartida();
  };

  const deleteComposicion = async (compId: string) => {
    await fetch(`/api/partidas/${id}/composicion/${compId}`, { method: "DELETE" });
    fetchPartida();
  };

  if (loading) {
    return (
      <div className="p-8 text-gray-400">Cargando…</div>
    );
  }

  if (!partida) {
    return <div className="p-8 text-red-500">Partida no encontrada</div>;
  }

  const field = (label: string, key: keyof Partida, type: "text" | "number" = "text") => (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={String(form[key] ?? "")}
        onChange={(e) =>
          setForm((prev) => ({
            ...prev,
            [key]: type === "number" ? parseFloat(e.target.value) : e.target.value,
          }))
        }
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
      />
    </div>
  );

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate("/partidas")}
          className="text-gray-400 hover:text-gray-700 text-sm"
        >
          ← Partidas
        </button>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900">
          {partida.codigo} — {partida.descripcion}
        </h1>
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="font-semibold text-gray-700 mb-4">Datos de la partida</h2>
        <div className="grid grid-cols-2 gap-4">
          {field("Código", "codigo")}
          {field("Rubro", "rubro")}
          {field("Descripción", "descripcion")}
          {field("Unidad", "unidad")}
          {field("Rendimiento", "rendimiento", "number")}
          {field("Grado de dificultad", "gradoDificultad", "number")}
          {field("% Desperdicio consumibles", "pctDesperdicioConsumibles", "number")}
          {field("% Desperdicio general", "pctDesperdicioGeneral", "number")}
          {field("MAT unitario", "matUnitario", "number")}
          {field("MO unitario", "moUnitario", "number")}
          {field("EQ unitario", "eqUnitario", "number")}
          {field("CD unitario", "cdUnitario", "number")}
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

      {/* Composición */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-700 mb-4">Composición</h2>
        <ComposicionTable
          title="Materiales"
          tipo="MATERIAL"
          rows={partida.composiciones}
          onUpdate={updateComposicion}
          onDelete={deleteComposicion}
        />
        <ComposicionTable
          title="Mano de Obra"
          tipo="MANO_DE_OBRA"
          rows={partida.composiciones}
          onUpdate={updateComposicion}
          onDelete={deleteComposicion}
        />
        <ComposicionTable
          title="Equipos"
          tipo="EQUIPO"
          rows={partida.composiciones}
          onUpdate={updateComposicion}
          onDelete={deleteComposicion}
        />
      </div>
    </div>
  );
}

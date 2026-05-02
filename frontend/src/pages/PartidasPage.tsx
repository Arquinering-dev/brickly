import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

interface Partida {
  id: string;
  codigo: string;
  rubro: string;
  descripcion: string;
  unidad: string;
  rendimiento: number;
  matUnitario: number;
  moUnitario: number;
  eqUnitario: number;
  cdUnitario: number;
}

export default function PartidasPage() {
  const navigate = useNavigate();
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [rubro, setRubro] = useState("");
  const [rubros, setRubros] = useState<string[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchPartidas = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (rubro) params.set("rubro", rubro);
    const res = await fetch(`/api/partidas?${params}`);
    const data: Partida[] = await res.json();
    setPartidas(data);
    const uniqueRubros = [...new Set(data.map((p) => p.rubro))].filter(Boolean).sort();
    setRubros(uniqueRubros);
    setLoading(false);
  }, [search, rubro]);

  useEffect(() => {
    const t = setTimeout(fetchPartidas, 250);
    return () => clearTimeout(t);
  }, [fetchPartidas]);

  const confirmDelete = async () => {
    if (!deleteId) return;
    await fetch(`/api/partidas/${deleteId}`, { method: "DELETE" });
    setDeleteId(null);
    fetchPartidas();
  };

  const fmt = (n: number) =>
    Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Partidas</h1>
          <p className="text-sm text-gray-500">{partidas.length} partidas</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <input
          type="text"
          placeholder="Buscar código o descripción…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <select
          value={rubro}
          onChange={(e) => setRubro(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        >
          <option value="">Todos los rubros</option>
          {rubros.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Código</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Descripción</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Rubro</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Ud.</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Rend.</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">MAT</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">MO</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">EQ</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="text-center py-12 text-gray-400">
                  Cargando…
                </td>
              </tr>
            ) : partidas.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-12 text-gray-400">
                  No hay partidas. Importá un APU primero.
                </td>
              </tr>
            ) : (
              partidas.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{p.codigo}</td>
                  <td className="px-4 py-3 text-gray-800 max-w-xs truncate">{p.descripcion}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded">
                      {p.rubro || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{p.unidad}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{fmt(p.rendimiento)}</td>
                  <td className="px-4 py-3 text-right text-blue-700">${fmt(p.matUnitario)}</td>
                  <td className="px-4 py-3 text-right text-green-700">${fmt(p.moUnitario)}</td>
                  <td className="px-4 py-3 text-right text-orange-700">${fmt(p.eqUnitario)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => navigate(`/partidas/${p.id}`)}
                        className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-100 transition-colors"
                      >
                        Ver
                      </button>
                      <button
                        onClick={() => setDeleteId(p.id)}
                        className="px-2 py-1 text-xs border border-red-100 text-red-500 rounded hover:bg-red-50 transition-colors"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Delete confirmation modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
            <h3 className="font-semibold text-gray-900 mb-2">¿Eliminar partida?</h3>
            <p className="text-sm text-gray-500 mb-5">
              Esta acción eliminará la partida y su composición. No se puede deshacer.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

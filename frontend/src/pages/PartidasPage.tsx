import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Paginador } from "../components/Paginador";

const PER_PAGE = 25;

interface Partida {
  id: string;
  codigo: string;
  rubro: string;
  descripcion: string;
  unidad: string;
  rendimiento: number | null;
  tipo: "APU" | "SUBCONTRATO" | "COTIZACION_DIRECTA";
  activa: boolean;
  _count: { composiciones: number };
}

const TIPO_BADGE: Record<string, { label: string; className: string }> = {
  APU: { label: "APU", className: "bg-blue-100 text-blue-700" },
  SUBCONTRATO: { label: "Subcontrato", className: "bg-orange-100 text-orange-700" },
  COTIZACION_DIRECTA: { label: "Cotización", className: "bg-gray-100 text-gray-600" },
};

export default function PartidasPage() {
  const navigate = useNavigate();
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [rubro, setRubro] = useState("");
  const [tipo, setTipo] = useState("");
  const [rubros, setRubros] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  const fetchPartidas = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (rubro) params.set("rubro", rubro);
    if (tipo) params.set("tipo", tipo);
    params.set("activa", "true");
    const res = await fetch(`/api/partidas?${params}`);
    const data: Partida[] = await res.json();
    setPartidas(data);
    const uniqueRubros = [...new Set(data.map((p) => p.rubro))].filter(Boolean).sort();
    setRubros(uniqueRubros);
    setLoading(false);
  }, [search, rubro, tipo]);

  useEffect(() => {
    const t = setTimeout(fetchPartidas, 250);
    return () => clearTimeout(t);
  }, [fetchPartidas]);

  useEffect(() => { setPage(1); }, [search, rubro, tipo]);

  const desactivar = async (id: string) => {
    await fetch(`/api/partidas/${id}`, { method: "DELETE" });
    fetchPartidas();
  };

  const paginadas = partidas.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Partidas</h1>
          <p className="text-sm text-gray-500">{partidas.length} partidas activas</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
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
          {rubros.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        >
          <option value="">Todos los tipos</option>
          <option value="APU">APU</option>
          <option value="SUBCONTRATO">Subcontrato</option>
          <option value="COTIZACION_DIRECTA">Cotización directa</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Código</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Descripción</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Rubro</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Ud.</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Rend.</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Insumos</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">Cargando…</td></tr>
            ) : partidas.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">No hay partidas. Importá un APU primero.</td></tr>
            ) : (
              paginadas.map((p) => {
                const badge = TIPO_BADGE[p.tipo] ?? TIPO_BADGE.APU;
                return (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{p.codigo}</td>
                    <td className="px-4 py-3 text-gray-800 max-w-xs truncate">{p.descripcion}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded">{p.rubro || "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{p.unidad}</td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {p.rendimiento != null ? Number(p.rendimiento).toFixed(2) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs px-2 py-0.5 rounded font-medium ${badge.className}`}>{badge.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">{p._count.composiciones}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => navigate(`/partidas/${p.id}`)}
                          title="Ver detalle"
                          className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-100 transition-colors"
                        >
                          Ver
                        </button>
                        <button
                          onClick={() => desactivar(p.id)}
                          title="Desactivar"
                          className="px-2 py-1 text-xs border border-red-100 text-red-500 rounded hover:bg-red-50 transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <Paginador total={partidas.length} page={page} perPage={PER_PAGE} onChange={setPage} />
      </div>
    </div>
  );
}

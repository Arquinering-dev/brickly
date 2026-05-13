import { useState, useEffect } from "react";
import { Paginador } from "../components/Paginador";

const PER_PAGE = 25;

interface Insumo {
  id: string;
  codigo: string;
  descripcion: string;
  tipo: "MATERIAL" | "MANO_DE_OBRA" | "EQUIPO" | "SUBCONTRATO";
  unidad: string;
  precioReferencia: number;
  proveedor?: string;
  categoria?: string;
}

type Tab = "MATERIAL" | "MANO_DE_OBRA" | "EQUIPO" | "SUBCONTRATO";

const TABS: Tab[] = ["MATERIAL", "MANO_DE_OBRA", "EQUIPO", "SUBCONTRATO"];

const TAB_LABELS: Record<Tab, string> = {
  MATERIAL: "Materiales",
  MANO_DE_OBRA: "Mano de Obra",
  EQUIPO: "Equipos",
  SUBCONTRATO: "Subcontratos",
};

function fmt(n: number) {
  return Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CatalogosPage() {
  const [tab, setTab] = useState<Tab>("MATERIAL");
  const [search, setSearch] = useState("");
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [counts, setCounts] = useState<Partial<Record<Tab, number>>>({});
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [tab, search]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ tipo: tab });
    if (search) params.set("search", search);
    fetch(`/api/insumos?${params}`)
      .then((r) => r.json())
      .then((data: Insumo[]) => {
        setInsumos(data);
        setCounts((prev) => ({ ...prev, [tab]: data.length }));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tab, search]);

  const tabClass = (t: Tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      tab === t
        ? "border-brand-500 text-brand-600"
        : "border-transparent text-gray-500 hover:text-gray-700"
    }`;

  const colSpanFull = tab === "MATERIAL" ? 6 : tab === "SUBCONTRATO" ? 5 : 4;
  const paginados = insumos.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Catálogos</h1>

      <div className="flex gap-1 border-b border-gray-200 mb-5">
        {TABS.map((t) => (
          <button key={t} className={tabClass(t)} onClick={() => setTab(t)}>
            {TAB_LABELS[t]} {(counts[t] ?? 0) > 0 && `(${counts[t]})`}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por código o descripción…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
      </div>

      {loading ? (
        <div className="text-gray-400 py-8 text-center">Cargando…</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Código</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Descripción</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Unidad</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Precio ref.</th>
                {tab === "MATERIAL" && (
                  <>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Proveedor</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Categoría</th>
                  </>
                )}
                {tab === "SUBCONTRATO" && (
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Categoría</th>
                )}
              </tr>
            </thead>
            <tbody>
              {insumos.length === 0 ? (
                <tr>
                  <td colSpan={colSpanFull} className="text-center py-12 text-gray-400">
                    Sin datos. Importá el APU unificado primero.
                  </td>
                </tr>
              ) : (
                paginados.map((ins) => (
                  <tr key={ins.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2 font-mono text-xs text-gray-500">{ins.codigo}</td>
                    <td className="px-4 py-2 text-gray-800">{ins.descripcion}</td>
                    <td className="px-4 py-2 text-gray-500">{ins.unidad}</td>
                    <td className="px-4 py-2 text-right font-medium text-gray-700">${fmt(ins.precioReferencia)}</td>
                    {tab === "MATERIAL" && (
                      <>
                        <td className="px-4 py-2 text-gray-500">{ins.proveedor ?? "—"}</td>
                        <td className="px-4 py-2 text-gray-500">{ins.categoria ?? "—"}</td>
                      </>
                    )}
                    {tab === "SUBCONTRATO" && (
                      <td className="px-4 py-2 text-gray-500">{ins.categoria ?? "—"}</td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <Paginador total={insumos.length} page={page} perPage={PER_PAGE} onChange={setPage} />
        </div>
      )}
    </div>
  );
}

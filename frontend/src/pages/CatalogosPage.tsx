import { useState, useEffect } from "react";

interface Material {
  id: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  precio: number;
  proveedor?: string;
  categoria?: string;
}

interface ManoDeObra {
  id: string;
  codigo: string;
  descripcion: string;
  salarioDia: number;
  coefCargas: number;
  tipo: string;
}

interface Equipo {
  id: string;
  codigo: string;
  descripcion: string;
  costoTotal: number;
  vidaDias: number;
  costoDia: number;
}

type Tab = "materiales" | "mano-de-obra" | "equipos";

function fmt(n: number) {
  return Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2 });
}

export default function CatalogosPage() {
  const [tab, setTab] = useState<Tab>("materiales");
  const [search, setSearch] = useState("");
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [mos, setMos] = useState<ManoDeObra[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = search ? `?search=${encodeURIComponent(search)}` : "";

    Promise.all([
      fetch(`/api/materiales${params}`).then((r) => r.json()),
      fetch("/api/mano-de-obra").then((r) => r.json()),
      fetch("/api/equipos").then((r) => r.json()),
    ]).then(([mats, mos, eqs]) => {
      setMateriales(mats);
      setMos(mos);
      setEquipos(eqs);
      setLoading(false);
    });
  }, [search]);

  const tabClass = (t: Tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      tab === t
        ? "border-brand-500 text-brand-600"
        : "border-transparent text-gray-500 hover:text-gray-700"
    }`;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Catálogos</h1>

      <div className="flex gap-1 border-b border-gray-200 mb-5">
        <button className={tabClass("materiales")} onClick={() => setTab("materiales")}>
          Materiales ({materiales.length})
        </button>
        <button className={tabClass("mano-de-obra")} onClick={() => setTab("mano-de-obra")}>
          Mano de Obra ({mos.length})
        </button>
        <button className={tabClass("equipos")} onClick={() => setTab("equipos")}>
          Equipos ({equipos.length})
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
      </div>

      {loading ? (
        <div className="text-gray-400 py-8">Cargando…</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {tab === "materiales" && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Código</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Descripción</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Unidad</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Precio</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Proveedor</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Categoría</th>
                </tr>
              </thead>
              <tbody>
                {materiales.map((m) => (
                  <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs">{m.codigo}</td>
                    <td className="px-4 py-2">{m.descripcion}</td>
                    <td className="px-4 py-2 text-gray-500">{m.unidad}</td>
                    <td className="px-4 py-2 text-right font-medium">${fmt(m.precio)}</td>
                    <td className="px-4 py-2 text-gray-500">{m.proveedor ?? "—"}</td>
                    <td className="px-4 py-2 text-gray-500">{m.categoria ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === "mano-de-obra" && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Código</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Descripción</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Salario/día</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Coef. Cargas</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {mos.map((m) => (
                  <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs">{m.codigo}</td>
                    <td className="px-4 py-2">{m.descripcion}</td>
                    <td className="px-4 py-2 text-right">${fmt(m.salarioDia)}</td>
                    <td className="px-4 py-2 text-right">{Number(m.coefCargas).toFixed(3)}</td>
                    <td className="px-4 py-2 text-gray-500">{m.tipo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === "equipos" && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Código</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Descripción</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Costo total</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Vida (días)</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Costo/día</th>
                </tr>
              </thead>
              <tbody>
                {equipos.map((e) => (
                  <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs">{e.codigo}</td>
                    <td className="px-4 py-2">{e.descripcion}</td>
                    <td className="px-4 py-2 text-right">${fmt(e.costoTotal)}</td>
                    <td className="px-4 py-2 text-right">{e.vidaDias}</td>
                    <td className="px-4 py-2 text-right">${fmt(e.costoDia)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

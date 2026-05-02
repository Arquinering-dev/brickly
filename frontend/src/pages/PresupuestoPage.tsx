import { useState, useEffect } from "react";

interface LineaPartida {
  id: string;
  cantidad: number;
  matTotal: number;
  moTotal: number;
  eqTotal: number;
  partida: {
    codigo: string;
    descripcion: string;
    rubro: string;
    unidad: string;
  };
}

interface GrupoRubro {
  rubro: string;
  matTotal: number;
  moTotal: number;
  eqTotal: number;
  total: number;
  partidas: LineaPartida[];
}

interface PresupuestoData {
  grupos: GrupoRubro[];
  totalGeneral: number;
}

function fmt(n: number) {
  return Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2 });
}

export default function PresupuestoPage() {
  const [data, setData] = useState<PresupuestoData | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/presupuesto")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, []);

  const toggle = (rubro: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(rubro) ? next.delete(rubro) : next.add(rubro);
      return next;
    });

  if (loading) return <div className="p-8 text-gray-400">Cargando…</div>;
  if (!data || data.grupos.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Presupuesto</h1>
        <p className="text-gray-400">Sin líneas de presupuesto. Importá un APU con datos de PPTO_APROBADO.</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Presupuesto</h1>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 font-medium text-gray-500 w-8"></th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Rubro / Partida</th>
              <th className="text-right px-4 py-3 font-medium text-blue-500">MAT</th>
              <th className="text-right px-4 py-3 font-medium text-green-500">MO</th>
              <th className="text-right px-4 py-3 font-medium text-orange-500">EQ</th>
              <th className="text-right px-4 py-3 font-medium text-gray-700">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.grupos.map((grupo) => (
              <>
                <tr
                  key={grupo.rubro}
                  onClick={() => toggle(grupo.rubro)}
                  className="border-b border-gray-100 cursor-pointer hover:bg-gray-50 bg-gray-50"
                >
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {expanded.has(grupo.rubro) ? "▼" : "▶"}
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-800">{grupo.rubro}</td>
                  <td className="px-4 py-3 text-right text-blue-700">${fmt(grupo.matTotal)}</td>
                  <td className="px-4 py-3 text-right text-green-700">${fmt(grupo.moTotal)}</td>
                  <td className="px-4 py-3 text-right text-orange-700">${fmt(grupo.eqTotal)}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">
                    ${fmt(grupo.total)}
                  </td>
                </tr>
                {expanded.has(grupo.rubro) &&
                  grupo.partidas.map((linea) => (
                    <tr key={linea.id} className="border-b border-gray-50 bg-white">
                      <td className="px-4 py-2"></td>
                      <td className="px-4 py-2 pl-8 text-gray-600">
                        <span className="font-mono text-xs text-gray-400 mr-2">
                          {linea.partida.codigo}
                        </span>
                        {linea.partida.descripcion}
                        <span className="text-xs text-gray-400 ml-1">
                          ({fmt(linea.cantidad)} {linea.partida.unidad})
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right text-blue-600 text-xs">
                        ${fmt(linea.matTotal)}
                      </td>
                      <td className="px-4 py-2 text-right text-green-600 text-xs">
                        ${fmt(linea.moTotal)}
                      </td>
                      <td className="px-4 py-2 text-right text-orange-600 text-xs">
                        ${fmt(linea.eqTotal)}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-700 text-xs">
                        ${fmt(Number(linea.matTotal) + Number(linea.moTotal) + Number(linea.eqTotal))}
                      </td>
                    </tr>
                  ))}
              </>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-gray-50">
              <td></td>
              <td className="px-4 py-3 font-bold text-gray-900">TOTAL GENERAL</td>
              <td className="px-4 py-3 text-right font-bold text-blue-700">
                ${fmt(data.grupos.reduce((a, g) => a + g.matTotal, 0))}
              </td>
              <td className="px-4 py-3 text-right font-bold text-green-700">
                ${fmt(data.grupos.reduce((a, g) => a + g.moTotal, 0))}
              </td>
              <td className="px-4 py-3 text-right font-bold text-orange-700">
                ${fmt(data.grupos.reduce((a, g) => a + g.eqTotal, 0))}
              </td>
              <td className="px-4 py-3 text-right font-bold text-gray-900 text-base">
                ${fmt(data.totalGeneral)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

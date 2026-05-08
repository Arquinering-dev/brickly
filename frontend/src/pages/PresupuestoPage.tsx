import { useState, useEffect } from "react";

interface Obra {
  id: string;
  nombre: string;
  codigo: string;
}

interface ComposicionDetalle {
  insumo: string;
  codigo: string;
  tipo: "MATERIAL" | "MANO_DE_OBRA" | "EQUIPO" | "SUBCONTRATO";
  cantidadPorUnidad: number;
  pctDesperdicio: number;
  precioReferencia: number;
  cantidadTotal: number;
  costoTotal: number;
}

interface LineaPresupuesto {
  id: string;
  itemNumero: string | null;
  descripcion: string;
  unidad: string;
  cantidad: number;
  matUd: number | null;
  moUd: number | null;
  eqUd: number | null;
  precioUnitario: number;
  precioVenta: number | null;
  total: number;
  matTotal: number;
  moTotal: number;
  eqTotal: number;
  tipo: string;
  fuente: string | null;
  estadoItem: string;
  partidaId: string | null;
  apuLinkCodigo: string | null;
  composicion: ComposicionDetalle[];
}

interface GrupoRubro {
  nombre: string;
  totalMat: number;
  totalMO: number;
  totalEQ: number;
  totalPV: number;
  totalRubro: number;
  lineas: LineaPresupuesto[];
}

interface PresupuestoHeader {
  nombre: string | null;
  version: string | null;
  mesCac: string;
  coefGGBB: number | null;
}

interface PresupuestoData {
  obra: { id: string; nombre: string; codigo: string };
  presupuesto: PresupuestoHeader | null;
  cacValor: number | null;
  mesCac: string | null;
  totalMat: number;
  totalMO: number;
  totalEQ: number;
  totalGeneral: number;
  totalPV: number;
  rubros: GrupoRubro[];
}

function fmt(n: number, decimals = 0) {
  return Number(n).toLocaleString("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

const TIPO_COMP_LABEL: Record<string, string> = {
  MATERIAL: "MAT",
  MANO_DE_OBRA: "MO",
  EQUIPO: "EQ",
  SUBCONTRATO: "SUB",
};
const TIPO_COMP_CLASS: Record<string, string> = {
  MATERIAL: "text-blue-600",
  MANO_DE_OBRA: "text-brand-600",
  EQUIPO: "text-amber-600",
  SUBCONTRATO: "text-purple-600",
};

export default function PresupuestoPage() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [obraId, setObraId] = useState("");
  const [data, setData] = useState<PresupuestoData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedLinea, setExpandedLinea] = useState<Set<string>>(new Set());
  const [showPV, setShowPV] = useState(false);

  useEffect(() => {
    fetch("/api/obras")
      .then((r) => r.json())
      .then((list: Obra[]) => {
        setObras(list);
        if (list.length > 0) setObraId(list[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!obraId) return;
    setLoading(true);
    setData(null);
    setExpanded(new Set());
    fetch(`/api/obras/${obraId}/presupuesto`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [obraId]);

  const toggleRubro = (nombre: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(nombre) ? next.delete(nombre) : next.add(nombre);
      return next;
    });

  const toggleLinea = (id: string) =>
    setExpandedLinea((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const expandAll = () => {
    if (!data) return;
    if (expanded.size === data.rubros.length) {
      setExpanded(new Set());
    } else {
      setExpanded(new Set(data.rubros.map((r) => r.nombre)));
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Presupuesto Generador</h1>
          {data?.presupuesto?.nombre && (
            <p className="text-sm text-gray-500 mt-0.5">{data.presupuesto.nombre}</p>
          )}
          {data?.presupuesto?.version && (
            <p className="text-xs text-gray-400">{data.presupuesto.version} · Base {data.presupuesto.mesCac}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showPV}
              onChange={(e) => setShowPV(e.target.checked)}
              className="accent-brand-500"
            />
            Precio Venta
            {data?.presupuesto?.coefGGBB && (
              <span className="text-gray-400">(×{data.presupuesto.coefGGBB.toFixed(4)})</span>
            )}
          </label>
          <select
            value={obraId}
            onChange={(e) => setObraId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 min-w-[220px]"
          >
            {obras.length === 0 && <option value="">Sin obras</option>}
            {obras.map((o) => (
              <option key={o.id} value={o.id}>{o.codigo} — {o.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI cards */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4 lg:col-span-2">
            <p className="text-xs text-gray-500 mb-0.5">Costo Directo Total</p>
            <p className="text-xl font-bold text-gray-900">${fmt(data.totalGeneral)}</p>
          </div>
          <div className="bg-white border border-blue-100 rounded-xl p-4">
            <p className="text-xs text-blue-500 mb-0.5">Materiales</p>
            <p className="text-lg font-bold text-blue-700">${fmt(data.totalMat)}</p>
            <p className="text-xs text-blue-400">{data.totalGeneral > 0 ? ((data.totalMat / data.totalGeneral) * 100).toFixed(1) : 0}%</p>
          </div>
          <div className="bg-white border border-brand-100 rounded-xl p-4">
            <p className="text-xs text-brand-500 mb-0.5">Mano de Obra</p>
            <p className="text-lg font-bold text-brand-700">${fmt(data.totalMO)}</p>
            <p className="text-xs text-brand-400">{data.totalGeneral > 0 ? ((data.totalMO / data.totalGeneral) * 100).toFixed(1) : 0}%</p>
          </div>
          <div className="bg-white border border-amber-100 rounded-xl p-4">
            <p className="text-xs text-amber-500 mb-0.5">Equipos</p>
            <p className="text-lg font-bold text-amber-700">${fmt(data.totalEQ)}</p>
            <p className="text-xs text-amber-400">{data.totalGeneral > 0 ? ((data.totalEQ / data.totalGeneral) * 100).toFixed(1) : 0}%</p>
          </div>
        </div>
      )}

      {loading && <div className="py-12 text-center text-gray-400">Cargando presupuesto…</div>}

      {!loading && data && data.rubros.length === 0 && (
        <div className="py-12 text-center text-gray-400">
          Sin líneas de presupuesto para esta obra. Importá el APU unificado en la sección Importar.
        </div>
      )}

      {!loading && data && data.rubros.length > 0 && (
        <>
          <div className="flex justify-end mb-2">
            <button
              onClick={expandAll}
              className="text-xs text-gray-500 hover:text-brand-600 transition-colors"
            >
              {expanded.size === data.rubros.length ? "Colapsar todo" : "Expandir todo"}
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs">
                  <th className="text-left px-3 py-3 font-medium text-gray-400 w-12">#</th>
                  <th className="text-left px-3 py-3 font-medium text-gray-500">Descripción</th>
                  <th className="text-left px-3 py-3 font-medium text-gray-400 w-12">Ud.</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-400 w-16">Cant.</th>
                  <th className="text-right px-3 py-3 font-medium text-blue-400 w-28">MAT/ud</th>
                  <th className="text-right px-3 py-3 font-medium text-brand-400 w-28">MO/ud</th>
                  <th className="text-right px-3 py-3 font-medium text-amber-400 w-28">EQ/ud</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-500 w-32">CD/ud</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-700 w-36">Total CD</th>
                  {showPV && (
                    <th className="text-right px-3 py-3 font-medium text-green-600 w-36">Precio Venta</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.rubros.map((grupo) => (
                  <>
                    {/* Rubro header */}
                    <tr
                      key={`rubro-${grupo.nombre}`}
                      onClick={() => toggleRubro(grupo.nombre)}
                      className="border-b border-gray-100 cursor-pointer hover:bg-brand-50 bg-gray-50"
                    >
                      <td className="px-3 py-3 text-gray-400 text-xs">
                        {expanded.has(grupo.nombre) ? "▼" : "▶"}
                      </td>
                      <td className="px-3 py-3 font-semibold text-gray-800 uppercase text-xs tracking-wide" colSpan={3}>
                        {grupo.nombre}
                      </td>
                      <td className="px-3 py-3 text-right text-xs text-blue-500">${fmt(grupo.totalMat)}</td>
                      <td className="px-3 py-3 text-right text-xs text-brand-500">${fmt(grupo.totalMO)}</td>
                      <td className="px-3 py-3 text-right text-xs text-amber-500">${fmt(grupo.totalEQ)}</td>
                      <td></td>
                      <td className="px-3 py-3 text-right font-bold text-gray-900">${fmt(grupo.totalRubro)}</td>
                      {showPV && (
                        <td className="px-3 py-3 text-right font-bold text-green-700">${fmt(grupo.totalPV)}</td>
                      )}
                    </tr>

                    {expanded.has(grupo.nombre) && grupo.lineas.map((linea) => (
                      <>
                        <tr
                          key={linea.id}
                          className={`border-b border-gray-50 ${linea.composicion.length > 0 ? "cursor-pointer hover:bg-gray-50" : "hover:bg-gray-50/50"}`}
                          onClick={() => linea.composicion.length > 0 && toggleLinea(linea.id)}
                        >
                          <td className="px-3 py-2 text-gray-400 text-xs font-mono pl-6">
                            {linea.itemNumero ?? ""}
                          </td>
                          <td className="px-3 py-2 text-gray-700 text-xs">
                            <span>{linea.descripcion}</span>
                            {linea.composicion.length > 0 && (
                              <span className="ml-1 text-gray-300 text-xs">
                                {expandedLinea.has(linea.id) ? "▾" : "▸"}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-400 text-xs">{linea.unidad}</td>
                          <td className="px-3 py-2 text-right text-gray-600 text-xs">{fmt(linea.cantidad, 2)}</td>
                          <td className="px-3 py-2 text-right text-blue-500 text-xs">
                            {linea.matUd !== null ? `$${fmt(linea.matUd)}` : "—"}
                          </td>
                          <td className="px-3 py-2 text-right text-brand-500 text-xs">
                            {linea.moUd !== null ? `$${fmt(linea.moUd)}` : "—"}
                          </td>
                          <td className="px-3 py-2 text-right text-amber-500 text-xs">
                            {linea.eqUd !== null ? `$${fmt(linea.eqUd)}` : "—"}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600 text-xs font-medium">
                            ${fmt(linea.precioUnitario)}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-800 text-xs">
                            ${fmt(linea.total)}
                          </td>
                          {showPV && (
                            <td className="px-3 py-2 text-right text-green-700 text-xs font-medium">
                              {linea.precioVenta !== null ? `$${fmt(linea.precioVenta)}` : "—"}
                            </td>
                          )}
                        </tr>

                        {expandedLinea.has(linea.id) && linea.composicion.length > 0 && (
                          <tr key={`comp-${linea.id}`} className="border-b border-gray-50 bg-gray-50/50">
                            <td colSpan={showPV ? 10 : 9} className="px-3 pb-3 pt-1 pl-14">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-gray-400">
                                    <th className="text-left py-1 font-medium">Código</th>
                                    <th className="text-left py-1 font-medium">Insumo</th>
                                    <th className="text-left py-1 font-medium">Tipo</th>
                                    <th className="text-right py-1 font-medium">Cant/ud</th>
                                    <th className="text-right py-1 font-medium">Desp.</th>
                                    <th className="text-right py-1 font-medium">Cant. total</th>
                                    <th className="text-right py-1 font-medium">Precio ref.</th>
                                    <th className="text-right py-1 font-medium">Costo total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {linea.composicion.map((comp, ci) => (
                                    <tr key={ci} className="border-t border-gray-100">
                                      <td className="py-1 font-mono text-gray-400">{comp.codigo}</td>
                                      <td className="py-1 text-gray-600">{comp.insumo}</td>
                                      <td className={`py-1 font-medium ${TIPO_COMP_CLASS[comp.tipo] ?? "text-gray-500"}`}>
                                        {TIPO_COMP_LABEL[comp.tipo] ?? comp.tipo}
                                      </td>
                                      <td className="py-1 text-right text-gray-500">{fmt(comp.cantidadPorUnidad, 4)}</td>
                                      <td className="py-1 text-right text-gray-500">{(comp.pctDesperdicio * 100).toFixed(1)}%</td>
                                      <td className="py-1 text-right text-gray-600">{fmt(comp.cantidadTotal, 3)}</td>
                                      <td className="py-1 text-right text-gray-500">${fmt(comp.precioReferencia)}</td>
                                      <td className="py-1 text-right font-medium text-gray-700">${fmt(comp.costoTotal)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td></td>
                  <td className="px-3 py-3 font-bold text-gray-900 text-xs uppercase tracking-wide" colSpan={3}>
                    TOTAL GENERAL
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-blue-600 text-xs">${fmt(data.totalMat)}</td>
                  <td className="px-3 py-3 text-right font-bold text-brand-600 text-xs">${fmt(data.totalMO)}</td>
                  <td className="px-3 py-3 text-right font-bold text-amber-600 text-xs">${fmt(data.totalEQ)}</td>
                  <td></td>
                  <td className="px-3 py-3 text-right font-bold text-gray-900 text-base">${fmt(data.totalGeneral)}</td>
                  {showPV && (
                    <td className="px-3 py-3 text-right font-bold text-green-700 text-base">${fmt(data.totalPV)}</td>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

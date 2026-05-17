import { apiFetch } from "../lib/api";
import { useState, useEffect } from "react";
import { useObras } from "../hooks/useObras";
import { getCached, setCached, isStale } from "../lib/cache";

interface ComposicionDetalle {
  insumo: string;
  codigo: string;
  tipo: "MATERIAL" | "MANO_DE_OBRA" | "EQUIPO" | "SUBCONTRATO";
  unidad: string;
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
  MATERIAL: "MAT", MANO_DE_OBRA: "MO", EQUIPO: "EQ", SUBCONTRATO: "SUB",
};
const TIPO_COMP_CLASS: Record<string, string> = {
  MATERIAL: "text-blue-600", MANO_DE_OBRA: "text-brand-600", EQUIPO: "text-amber-600", SUBCONTRATO: "text-purple-600",
};


function SkeletonKPI() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6 animate-pulse">
      <div className="bg-gray-100 rounded-xl h-20 lg:col-span-2" />
      <div className="bg-gray-100 rounded-xl h-20" />
      <div className="bg-gray-100 rounded-xl h-20" />
      <div className="bg-gray-100 rounded-xl h-20" />
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
      <div className="bg-gray-50 border-b border-gray-100 h-10" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="border-b border-gray-50 px-4 py-3 flex gap-4">
          <div className="bg-gray-100 rounded h-3 w-8" />
          <div className="bg-gray-100 rounded h-3 flex-1" />
          <div className="bg-gray-100 rounded h-3 w-20" />
          <div className="bg-gray-100 rounded h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

export default function PresupuestoPage() {
  const { obras, obrasLoading } = useObras();
  const [obraId, setObraId] = useState("");
  const [data, setData] = useState<PresupuestoData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedLinea, setExpandedLinea] = useState<Set<string>>(new Set());
  const [showPV, setShowPV] = useState(false);
  const [showDesglose, setShowDesglose] = useState(false);

  useEffect(() => {
    if (obras.length > 0 && !obraId) setObraId(obras[0].id);
  }, [obras, obraId]);

  useEffect(() => {
    if (!obraId) return;
    const cacheKey = `presupuesto:${obraId}`;
    const cached = getCached<PresupuestoData>(cacheKey);
    if (cached) { setData(cached); setFetchError(null); }
    if (!isStale(cacheKey)) return;
    setLoading(!cached);
    setExpanded(new Set());
    apiFetch(`/api/obras/${obraId}/presupuesto`)
      .then((r) => { if (!r.ok) throw new Error(`Error ${r.status}`); return r.json(); })
      .then((d: PresupuestoData) => { setCached(cacheKey, d); setData(d); setFetchError(null); })
      .catch((e) => setFetchError(e.message))
      .finally(() => setLoading(false));
  }, [obraId]);

  const toggleRubro = (nombre: string) =>
    setExpanded((prev) => { const s = new Set(prev); s.has(nombre) ? s.delete(nombre) : s.add(nombre); return s; });

  const toggleLinea = (id: string) =>
    setExpandedLinea((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const expandAll = () => {
    if (!data) return;
    if (expanded.size === data.rubros.length) setExpanded(new Set());
    else setExpanded(new Set(data.rubros.map((r) => r.nombre)));
  };

  // Total column count for colSpan calculations (# | Desc | Ud | Cant | [3 desglose] | CD/ud | Total | [PV])
  const colCount = 6 + (showDesglose ? 3 : 0) + (showPV ? 1 : 0);

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Presupuesto</h1>
          {data?.presupuesto?.nombre && (
            <p className="text-sm text-gray-500 mt-0.5">{data.presupuesto.nombre}</p>
          )}
          {data?.presupuesto?.version && (
            <p className="text-xs text-gray-400">{data.presupuesto.version} · Base {data.presupuesto.mesCac}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Obra selector */}
          {obrasLoading ? (
            <div className="animate-pulse bg-gray-100 rounded-lg h-9 w-52" />
          ) : (
            <select
              value={obraId}
              onChange={(e) => { setObraId(e.target.value); setData(null); setFetchError(null); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 min-w-[200px]"
            >
              {obras.length === 0 && <option value="">Sin obras</option>}
              {obras.map((o) => (
                <option key={o.id} value={o.id}>{o.codigo} — {o.nombre}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* KPI skeleton */}
      {(obrasLoading || loading) && !data && <SkeletonKPI />}

      {/* KPI cards */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="bg-gray-900 rounded-xl p-4 lg:col-span-1">
            <p className="text-xs text-gray-400 mb-1">Costo Directo Total</p>
            <p className="text-2xl font-bold text-white">${fmt(data.totalGeneral)}</p>
          </div>
          <div className="bg-white border border-blue-100 rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              <p className="text-xs text-blue-500 font-medium">Materiales</p>
            </div>
            <p className="text-lg font-bold text-blue-700">${fmt(data.totalMat)}</p>
            <p className="text-xs text-blue-400 mt-0.5">{data.totalGeneral > 0 ? ((data.totalMat / data.totalGeneral) * 100).toFixed(1) : 0}%</p>
          </div>
          <div className="bg-white border border-brand-100 rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-2 h-2 rounded-full bg-brand-400" />
              <p className="text-xs text-brand-500 font-medium">Mano de Obra</p>
            </div>
            <p className="text-lg font-bold text-brand-700">${fmt(data.totalMO)}</p>
            <p className="text-xs text-brand-400 mt-0.5">{data.totalGeneral > 0 ? ((data.totalMO / data.totalGeneral) * 100).toFixed(1) : 0}%</p>
          </div>
          <div className="bg-white border border-amber-100 rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <p className="text-xs text-amber-500 font-medium">Equipos</p>
            </div>
            <p className="text-lg font-bold text-amber-700">${fmt(data.totalEQ)}</p>
            <p className="text-xs text-amber-400 mt-0.5">{data.totalGeneral > 0 ? ((data.totalEQ / data.totalGeneral) * 100).toFixed(1) : 0}%</p>
          </div>
        </div>
      )}

      {loading && !data && <SkeletonTable />}

      {loading && data && (
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-3">
          <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Actualizando…
        </div>
      )}

      {!loading && fetchError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <p className="text-sm font-medium text-red-700">No se pudo cargar el presupuesto</p>
          <p className="text-xs text-red-500 mt-0.5">{fetchError}</p>
        </div>
      )}

      {!loading && !fetchError && data && data.rubros.length === 0 && (
        <div className="py-12 text-center text-gray-400">
          Sin líneas de presupuesto para esta obra. Importá el APU unificado en la sección Importar.
        </div>
      )}

      {!fetchError && data && data.rubros.length > 0 && (
        <>
          {/* Table controls */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDesglose((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  showDesglose
                    ? "bg-gray-900 text-white border-gray-900"
                    : "text-gray-600 border-gray-300 hover:border-gray-400 bg-white"
                }`}
              >
                <span className="flex gap-0.5">
                  <span className="w-2 h-2 rounded-sm bg-blue-400 inline-block" />
                  <span className="w-2 h-2 rounded-sm bg-brand-400 inline-block" />
                  <span className="w-2 h-2 rounded-sm bg-amber-400 inline-block" />
                </span>
                Desglose MAT/MO/EQ
              </button>
              <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none px-2">
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
            </div>
            <button
              onClick={expandAll}
              className="text-xs text-gray-400 hover:text-brand-600 transition-colors"
            >
              {expanded.size === data.rubros.length ? "Colapsar todo" : "Expandir todo"}
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-400">
                  <th className="text-left px-3 py-2.5 font-medium w-14">#</th>
                  <th className="text-left px-3 py-2.5 font-medium">Descripción</th>
                  <th className="text-left px-3 py-2.5 font-medium w-10">Ud.</th>
                  <th className="text-right px-3 py-2.5 font-medium w-14">Cant.</th>
                  {showDesglose && <>
                    <th className="text-right px-3 py-2.5 font-medium text-blue-400 w-28">MAT total</th>
                    <th className="text-right px-3 py-2.5 font-medium text-brand-400 w-28">MO total</th>
                    <th className="text-right px-3 py-2.5 font-medium text-amber-400 w-28">EQ total</th>
                  </>}
                  <th className="text-right px-3 py-2.5 font-medium text-gray-500 w-28">CD/ud</th>
                  <th className="text-right px-3 py-2.5 font-medium text-gray-800 w-36 border-l border-gray-100">Total CD</th>
                  {showPV && <th className="text-right px-3 py-2.5 font-medium text-green-600 w-36">P. Venta</th>}
                </tr>
              </thead>
              <tbody>
                {data.rubros.map((grupo) => (
                  <>
                    {/* Rubro header */}
                    <tr
                      key={`rubro-${grupo.nombre}`}
                      onClick={() => toggleRubro(grupo.nombre)}
                      className="border-b border-gray-100 cursor-pointer hover:bg-brand-50/60 bg-gray-50/80 select-none"
                    >
                      <td className="px-3 py-3 text-gray-400 w-14">
                        {expanded.has(grupo.nombre) ? "▼" : "▶"}
                      </td>
                      <td className="px-3 py-3" colSpan={showDesglose ? 4 : 3}>
                        <span className="font-bold text-gray-800 uppercase tracking-wide text-xs">
                          {grupo.nombre}
                        </span>
                      </td>
                      {showDesglose && <>
                        <td className="px-3 py-3 text-right font-semibold text-blue-600">${fmt(grupo.totalMat)}</td>
                        <td className="px-3 py-3 text-right font-semibold text-brand-600">${fmt(grupo.totalMO)}</td>
                        <td className="px-3 py-3 text-right font-semibold text-amber-600">${fmt(grupo.totalEQ)}</td>
                      </>}
                      <td className="px-3 py-3 text-right text-gray-400" />
                      <td className="px-3 py-3 text-right font-bold text-gray-900 text-sm border-l border-gray-100">
                        ${fmt(grupo.totalRubro)}
                      </td>
                      {showPV && <td className="px-3 py-3 text-right font-bold text-green-700">${fmt(grupo.totalPV)}</td>}
                    </tr>

                    {/* Line items — skip zero-cost entries */}
                    {expanded.has(grupo.nombre) && grupo.lineas.filter((l) => l.total > 0).map((linea) => (
                      <>
                        <tr
                          key={linea.id}
                          onClick={() => linea.composicion.length > 0 && toggleLinea(linea.id)}
                          className={`border-b border-gray-50 transition-colors ${
                            linea.composicion.length > 0
                              ? "cursor-pointer hover:bg-blue-50/30"
                              : "hover:bg-gray-50/50"
                          }`}
                        >
                          {/* Item # */}
                          <td className="px-3 py-2.5 text-gray-400 font-mono pl-5 align-top pt-3">
                            {linea.itemNumero ?? ""}
                          </td>

                          {/* Description — single line with tooltip, gets all available width */}
                          <td className="px-3 py-2.5 align-middle">
                            <div className="flex items-center gap-1 min-w-0">
                              <span
                                className="truncate text-gray-800 font-medium"
                                title={linea.descripcion}
                              >
                                {linea.descripcion}
                              </span>
                              {linea.composicion.length > 0 && (
                                <span className="shrink-0 text-gray-300 text-[10px]">
                                  {expandedLinea.has(linea.id) ? "▾" : "▸"}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Ud + Cant */}
                          <td className="px-3 py-2.5 text-gray-400 align-middle">{linea.unidad}</td>
                          <td className="px-3 py-2.5 text-right text-gray-600 align-middle tabular-nums">{fmt(linea.cantidad, 2)}</td>

                          {/* Desglose columns */}
                          {showDesglose && <>
                            <td className="px-3 py-2.5 text-right text-blue-500 align-middle tabular-nums">${fmt(linea.matTotal)}</td>
                            <td className="px-3 py-2.5 text-right text-brand-500 align-middle tabular-nums">${fmt(linea.moTotal)}</td>
                            <td className="px-3 py-2.5 text-right text-amber-500 align-middle tabular-nums">${fmt(linea.eqTotal)}</td>
                          </>}

                          {/* CD/ud */}
                          <td className="px-3 py-2.5 text-right text-gray-500 align-middle tabular-nums">
                            ${fmt(linea.precioUnitario)}
                          </td>

                          {/* Total CD — hero column */}
                          <td className="px-3 py-2.5 text-right align-middle border-l border-gray-100">
                            <span className="font-bold text-gray-900 text-sm tabular-nums">
                              ${fmt(linea.total)}
                            </span>
                          </td>

                          {showPV && (
                            <td className="px-3 py-2.5 text-right text-green-700 font-medium align-middle tabular-nums">
                              {linea.precioVenta !== null ? `$${fmt(linea.precioVenta)}` : "—"}
                            </td>
                          )}
                        </tr>

                        {/* Composition detail */}
                        {expandedLinea.has(linea.id) && linea.composicion.length > 0 && (
                          <tr key={`comp-${linea.id}`} className="border-b border-gray-50 bg-gray-50/40">
                            <td colSpan={colCount} className="pl-10 pr-4 pb-3 pt-1">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-gray-400 border-b border-gray-100">
                                    <th className="text-left pb-1.5 pt-1 font-medium">Tipo</th>
                                    <th className="text-left pb-1.5 pt-1 font-medium">Código</th>
                                    <th className="text-left pb-1.5 pt-1 font-medium">Descripción</th>
                                    <th className="text-left pb-1.5 pt-1 font-medium">Ud.</th>
                                    <th className="text-right pb-1.5 pt-1 font-medium">Cant. requerida</th>
                                    <th className="text-right pb-1.5 pt-1 font-medium">P. ref.</th>
                                    <th className="text-right pb-1.5 pt-1 font-medium">Costo</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {[...linea.composicion]
                                    .filter((c) => c.cantidadTotal > 0)
                                    .sort((a, b) => {
                                      const o = { MATERIAL: 0, MANO_DE_OBRA: 1, EQUIPO: 2, SUBCONTRATO: 3 } as const;
                                      return (o[a.tipo] ?? 99) - (o[b.tipo] ?? 99);
                                    })
                                    .map((comp, ci) => (
                                      <tr key={ci} className="border-t border-gray-100">
                                        <td className={`py-1.5 font-semibold ${TIPO_COMP_CLASS[comp.tipo] ?? "text-gray-500"}`}>
                                          {TIPO_COMP_LABEL[comp.tipo] ?? comp.tipo}
                                        </td>
                                        <td className="py-1.5 font-mono text-gray-400 text-[10px] whitespace-nowrap">{comp.codigo}</td>
                                        <td className="py-1.5 text-gray-700">{comp.insumo}</td>
                                        <td className="py-1.5 text-gray-400">{comp.unidad}</td>
                                        <td className="py-1.5 text-right text-gray-600 tabular-nums">{fmt(comp.cantidadTotal, 3)}</td>
                                        <td className="py-1.5 text-right text-gray-400 tabular-nums">${fmt(comp.precioReferencia)}</td>
                                        <td className="py-1.5 text-right font-medium text-gray-800 tabular-nums">${fmt(comp.costoTotal)}</td>
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
                  <td colSpan={showDesglose ? 4 : 4} className="px-3 py-3 font-bold text-gray-700 text-xs uppercase tracking-wide">
                    Total general
                  </td>
                  {showDesglose && <>
                    <td className="px-3 py-3 text-right font-bold text-blue-600 tabular-nums">${fmt(data.totalMat)}</td>
                    <td className="px-3 py-3 text-right font-bold text-brand-600 tabular-nums">${fmt(data.totalMO)}</td>
                    <td className="px-3 py-3 text-right font-bold text-amber-600 tabular-nums">${fmt(data.totalEQ)}</td>
                  </>}
                  <td />
                  <td className="px-3 py-3 text-right font-bold text-gray-900 text-base tabular-nums border-l border-gray-200">
                    ${fmt(data.totalGeneral)}
                  </td>
                  {showPV && <td className="px-3 py-3 text-right font-bold text-green-700 text-base tabular-nums">${fmt(data.totalPV)}</td>}
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

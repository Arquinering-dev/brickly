import { apiFetch } from "../lib/api";
import { useState, useEffect } from "react";
import { Paginador } from "../components/Paginador";

const PER_PAGE_TABLE = 20;

interface Obra {
  id: string;
  nombre: string;
  codigo: string;
}

interface InsumoAgregado {
  codigo: string;
  descripcion: string;
  tipo: string;
  unidad: string;
  categoria: string | null;
  cantidadTotal: number;
  precioUnitario: number;
  costoTotal: number;
}

interface Resumen {
  totalMat: number;
  totalMO: number;
  totalEQ: number;
  totalSub: number;
  totalCD: number;
  totalCDPpto: number;
}

interface PlanificacionData {
  obra: { id: string; nombre: string; codigo: string };
  rubros: string[];
  rubro: string | null;
  pctAvance: number;
  lineasTotal: number;
  lineasSinComposicion: number;
  materiales: InsumoAgregado[];
  manoDeObra: InsumoAgregado[];
  equipos: InsumoAgregado[];
  subcontratos: InsumoAgregado[];
  resumen: Resumen;
}

function fmt(n: number, dec = 0) {
  return Number(n).toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function pct(part: number, total: number) {
  if (!total) return "0%";
  return ((part / total) * 100).toFixed(1) + "%";
}

type SortDir = "asc" | "desc";
type Col = {
  label: string;
  key: keyof InsumoAgregado | string;
  align: "left" | "right";
  sortable?: boolean;
  render?: (row: InsumoAgregado) => string;
};

function TablaInsumos({
  titulo,
  datos,
  columnas,
  colorClass,
  bgClass,
  search,
}: {
  titulo: string;
  datos: InsumoAgregado[];
  columnas: Col[];
  colorClass: string;
  bgClass: string;
  search: string;
}) {
  const [sortKey, setSortKey] = useState<string>("costoTotal");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [search, datos]);

  const filtered = search
    ? datos.filter(
        (d) =>
          d.descripcion.toLowerCase().includes(search.toLowerCase()) ||
          d.codigo.toLowerCase().includes(search.toLowerCase()) ||
          (d.categoria ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : datos;

  const sorted = [...filtered].sort((a, b) => {
    const va = (a as unknown as Record<string, unknown>)[sortKey];
    const vb = (b as unknown as Record<string, unknown>)[sortKey];
    if (typeof va === "number" && typeof vb === "number") {
      return sortDir === "asc" ? va - vb : vb - va;
    }
    return sortDir === "asc"
      ? String(va ?? "").localeCompare(String(vb ?? ""))
      : String(vb ?? "").localeCompare(String(va ?? ""));
  });

  const total = filtered.reduce((s, d) => s + d.costoTotal, 0);
  const paginated = sorted.slice((page - 1) * PER_PAGE_TABLE, page * PER_PAGE_TABLE);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  if (datos.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className={`px-4 py-3 border-b border-gray-100 flex items-center justify-between ${bgClass}`}>
        <div className="flex items-center gap-2">
          <h3 className={`font-semibold text-sm ${colorClass}`}>{titulo}</h3>
          <span className="text-xs text-gray-400 bg-white/60 rounded-full px-2 py-0.5">
            {filtered.length} ítems
          </span>
        </div>
        <span className={`text-sm font-bold ${colorClass}`}>${fmt(total)}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {columnas.map((c) => (
                <th
                  key={c.label}
                  onClick={() => c.sortable !== false && toggleSort(String(c.key))}
                  className={`px-3 py-2.5 font-medium text-gray-500 select-none ${c.align === "right" ? "text-right" : "text-left"} ${c.sortable !== false ? "cursor-pointer hover:text-gray-700 hover:bg-gray-100 transition-colors" : ""}`}
                >
                  <span className={`flex items-center gap-1 ${c.align === "right" ? "justify-end" : ""}`}>
                    {c.label}
                    {c.sortable !== false && (
                      <span className="text-gray-300 text-[10px]">
                        {sortKey === String(c.key) ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((row, i) => (
              <tr
                key={row.codigo}
                className={`border-b border-gray-50 hover:bg-gray-50/60 transition-colors ${i % 2 === 0 ? "" : "bg-gray-50/40"}`}
              >
                {columnas.map((c) => (
                  <td
                    key={c.label}
                    className={`px-3 py-2.5 ${c.align === "right" ? "text-right" : ""} ${c.key === "codigo" ? "font-mono text-gray-400" : "text-gray-700"}`}
                  >
                    {c.render
                      ? c.render(row)
                      : String((row as unknown as Record<string, unknown>)[c.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-gray-50">
              <td colSpan={columnas.length - 1} className="px-3 py-2 font-semibold text-gray-700 text-xs">
                Subtotal
                {filtered.length < datos.length && (
                  <span className="font-normal text-gray-400 ml-1">
                    ({filtered.length} de {datos.length} ítems)
                  </span>
                )}
              </td>
              <td className={`px-3 py-2 text-right font-bold text-sm ${colorClass}`}>${fmt(total)}</td>
            </tr>
          </tfoot>
        </table>
        <Paginador total={filtered.length} page={page} perPage={PER_PAGE_TABLE} onChange={setPage} />
      </div>
    </div>
  );
}

function BarraComposicion({
  segmentos,
  total,
}: {
  segmentos: { label: string; value: number; bg: string; text: string }[];
  total: number;
}) {
  const activos = segmentos.filter((s) => s.value > 0);
  if (!total || activos.length === 0) return null;
  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <p className="text-xs text-gray-400 mb-2">Composición del costo directo</p>
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
        {activos.map((s) => (
          <div
            key={s.label}
            className={`${s.bg} transition-all duration-500`}
            style={{ width: `${(s.value / total) * 100}%` }}
            title={`${s.label}: ${((s.value / total) * 100).toFixed(1)}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2.5">
        {activos.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs text-gray-500">
            <div className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${s.bg}`} />
            <span>{s.label}</span>
            <span className={`font-semibold ${s.text}`}>{pct(s.value, total)}</span>
            <span className="text-gray-400">${fmt(s.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepBadge({ n, active }: { n: number; active: boolean }) {
  return (
    <div
      className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
        active ? "bg-brand-500 text-white" : "bg-gray-200 text-gray-400"
      }`}
    >
      {n}
    </div>
  );
}

export default function PlanificacionPage() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [obraId, setObraId] = useState("");
  const [rubros, setRubros] = useState<string[]>([]);
  const [rubro, setRubro] = useState("");
  const [data, setData] = useState<PlanificacionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    apiFetch("/api/obras")
      .then((r) => r.json())
      .then((list: Obra[]) => {
        setObras(list);
        if (list.length > 0) setObraId(list[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!obraId) return;
    setData(null);
    setRubro("");
    apiFetch(`/api/obras/${obraId}/planificacion`)
      .then((r) => r.json())
      .then((d) => {
        setRubros(d.rubros ?? []);
      })
      .catch(() => {});
  }, [obraId]);

  useEffect(() => {
    if (!obraId || !rubro) return;
    setLoading(true);
    setData(null);
    const params = new URLSearchParams({ pct: "1" });
    if (rubro === "__ALL__") params.set("all", "1");
    else params.set("rubro", rubro);
    apiFetch(`/api/obras/${obraId}/planificacion?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [obraId, rubro]);

  const colsMat: Col[] = [
    { label: "Código", key: "codigo", align: "left", sortable: false },
    { label: "Descripción", key: "descripcion", align: "left" },
    { label: "Categoría", key: "categoria", align: "left", render: (r) => r.categoria ?? "—" },
    { label: "Ud.", key: "unidad", align: "left", sortable: false },
    { label: "Cantidad", key: "cantidadTotal", align: "right", render: (r) => fmt(r.cantidadTotal, 2) },
    { label: "P. Unit.", key: "precioUnitario", align: "right", render: (r) => `$${fmt(r.precioUnitario)}` },
    { label: "Subtotal", key: "costoTotal", align: "right", render: (r) => `$${fmt(r.costoTotal)}` },
  ];

  const colsMO: Col[] = [
    { label: "Código", key: "codigo", align: "left", sortable: false },
    { label: "Categoría laboral", key: "descripcion", align: "left" },
    { label: "Jornales", key: "cantidadTotal", align: "right", render: (r) => fmt(r.cantidadTotal, 2) },
    { label: "Costo jornal", key: "precioUnitario", align: "right", render: (r) => `$${fmt(r.precioUnitario)}` },
    { label: "Subtotal MO", key: "costoTotal", align: "right", render: (r) => `$${fmt(r.costoTotal)}` },
  ];

  const colsEQ: Col[] = [
    { label: "Código", key: "codigo", align: "left", sortable: false },
    { label: "Equipo / herramienta", key: "descripcion", align: "left" },
    { label: "Días", key: "cantidadTotal", align: "right", render: (r) => fmt(r.cantidadTotal, 2) },
    { label: "Costo/día", key: "precioUnitario", align: "right", render: (r) => `$${fmt(r.precioUnitario)}` },
    { label: "Subtotal EQ", key: "costoTotal", align: "right", render: (r) => `$${fmt(r.costoTotal)}` },
  ];

  const colsSub: Col[] = [
    { label: "Código", key: "codigo", align: "left", sortable: false },
    { label: "Subcontrato", key: "descripcion", align: "left" },
    { label: "Ud.", key: "unidad", align: "left", sortable: false },
    { label: "Cantidad", key: "cantidadTotal", align: "right", render: (r) => fmt(r.cantidadTotal, 2) },
    { label: "P. Unit.", key: "precioUnitario", align: "right", render: (r) => `$${fmt(r.precioUnitario)}` },
    { label: "Subtotal SUB", key: "costoTotal", align: "right", render: (r) => `$${fmt(r.costoTotal)}` },
  ];

  const composicion = data
    ? [
        { label: "Materiales", value: data.resumen.totalMat, bg: "bg-blue-500", text: "text-blue-600" },
        { label: "Mano de Obra", value: data.resumen.totalMO, bg: "bg-brand-500", text: "text-brand-600" },
        { label: "Equipos", value: data.resumen.totalEQ, bg: "bg-amber-500", text: "text-amber-600" },
        { label: "Subcontratos", value: data.resumen.totalSub, bg: "bg-purple-500", text: "text-purple-600" },
      ]
    : [];

  return (
    <div className="p-6 lg:p-8 print:p-6">
      {/* Print-only header */}
      <div className="hidden print:block mb-6 pb-4 border-b-2 border-gray-400">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Lista de Insumos — Planificación de Etapa</h1>
            {data && (
              <p className="text-sm text-gray-600 mt-1">
                {data.obra.codigo} — {data.obra.nombre} | Etapa: {data.rubro ?? "Obra completa"}
              </p>
            )}
          </div>
          <p className="text-xs text-gray-400">
            {new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* Screen header */}
      <div className="mb-6 print:hidden flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Planificación de Etapa</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Consolidá materiales, mano de obra y equipos para ejecutar una etapa
          </p>
        </div>
        {data && rubro && (
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0 mt-1 shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            Imprimir lista
          </button>
        )}
      </div>

      {/* Guided filters */}
      <div className="print:hidden bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex flex-wrap gap-6 lg:gap-4 xl:gap-8 items-start">

          {/* Step 1 — Obra */}
          <div className="flex items-start gap-3 min-w-[200px] flex-1">
            <StepBadge n={1} active={true} />
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Obra</label>
              <select
                value={obraId}
                onChange={(e) => setObraId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
              >
                {obras.length === 0 && <option value="">Sin obras</option>}
                {obras.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.codigo} — {o.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="hidden lg:flex items-center pt-7 text-gray-200">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>

          {/* Step 2 — Etapa */}
          <div
            className={`flex items-start gap-3 min-w-[200px] flex-1 transition-opacity duration-200 ${
              !obraId ? "opacity-40 pointer-events-none" : ""
            }`}
          >
            <StepBadge n={2} active={!!obraId} />
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Etapa / Rubro</label>
              <select
                value={rubro}
                onChange={(e) => setRubro(e.target.value)}
                disabled={!obraId}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white disabled:bg-gray-50 disabled:cursor-not-allowed"
              >
                <option value="">— Seleccioná una etapa —</option>
                <option value="__ALL__">Todas las etapas (obra completa)</option>
                {rubros.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Search */}
          {data && (
            <>
              <div className="hidden lg:flex items-center pt-7 text-gray-200">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <div className="flex items-start gap-3 min-w-[180px] flex-1">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center mt-6">
                  <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Buscar insumo</label>
                  <input
                    type="text"
                    placeholder="descripción o código…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Empty state */}
      {!rubro && !loading && (
        <div className="py-20 text-center print:hidden">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
              />
            </svg>
          </div>
          <p className="text-base font-medium text-gray-500 mb-1">
            {!obraId ? "Seleccioná una obra para comenzar" : "Seleccioná una etapa para ver los requerimientos"}
          </p>
          <p className="text-sm text-gray-400">
            Materiales, mano de obra y equipos consolidados, listos para pedir
          </p>
        </div>
      )}

      {loading && (
        <div className="py-16 flex flex-col items-center gap-3 text-gray-400 print:hidden">
          <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
          <p className="text-sm">Calculando requerimientos…</p>
        </div>
      )}

      {/* Results */}
      {!loading && data && (data.rubro || rubro === "__ALL__") && (
        <>
          {/* KPI + composición */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <div className="mb-4">
              <div className="flex items-baseline gap-2 flex-wrap">
                <p className="text-2xl font-bold text-gray-900">${fmt(data.resumen.totalCD)}</p>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Costo directo — <span className="font-medium text-gray-700">{data.rubro ?? "obra completa"}</span>
              </p>
              {data.resumen.totalCDPpto > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {pct(data.resumen.totalCD, data.resumen.totalCDPpto)} del total presupuestado para esta etapa
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {composicion
                .filter((s) => s.value > 0)
                .map((s) => (
                  <div key={s.label} className="rounded-lg p-3 bg-gray-50 border border-gray-100">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className={`w-2 h-2 rounded-sm ${s.bg}`} />
                      <p className={`text-xs font-medium ${s.text}`}>{s.label}</p>
                    </div>
                    <p className="text-base font-bold text-gray-900">${fmt(s.value)}</p>
                    <p className={`text-xs mt-0.5 ${s.text} opacity-80`}>{pct(s.value, data.resumen.totalCD)}</p>
                  </div>
                ))}
            </div>

            <BarraComposicion segmentos={composicion} total={data.resumen.totalCD} />
          </div>

          {data.lineasSinComposicion > 0 && (
            <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2.5 flex items-center gap-2 text-xs text-yellow-700">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
              <span>
                <strong>{data.lineasSinComposicion}</strong> de <strong>{data.lineasTotal}</strong> líneas no tienen
                composición APU y no fueron incluidas en el cálculo.
              </span>
            </div>
          )}

          <div className="space-y-5">
            <TablaInsumos
              titulo="Materiales"
              datos={data.materiales}
              columnas={colsMat}
              colorClass="text-blue-700"
              bgClass="bg-blue-50/50"
              search={search}
            />
            <TablaInsumos
              titulo="Mano de Obra"
              datos={data.manoDeObra}
              columnas={colsMO}
              colorClass="text-brand-700"
              bgClass="bg-brand-50/50"
              search={search}
            />
            <TablaInsumos
              titulo="Equipos y Herramientas"
              datos={data.equipos}
              columnas={colsEQ}
              colorClass="text-amber-700"
              bgClass="bg-amber-50/50"
              search={search}
            />
            {data.subcontratos.length > 0 && (
              <TablaInsumos
                titulo="Subcontratos"
                datos={data.subcontratos}
                columnas={colsSub}
                colorClass="text-purple-700"
                bgClass="bg-purple-50/50"
                search={search}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

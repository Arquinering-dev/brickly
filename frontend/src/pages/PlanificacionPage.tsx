import { useState, useEffect } from "react";

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

type Col = { label: string; key: keyof InsumoAgregado | string; align: "left" | "right"; render?: (row: InsumoAgregado) => string };

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
  const filtered = search
    ? datos.filter(
        (d) =>
          d.descripcion.toLowerCase().includes(search.toLowerCase()) ||
          d.codigo.toLowerCase().includes(search.toLowerCase()) ||
          (d.categoria ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : datos;

  const total = filtered.reduce((s, d) => s + d.costoTotal, 0);

  if (datos.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className={`px-4 py-3 border-b border-gray-100 flex items-center justify-between ${bgClass}`}>
        <div className="flex items-center gap-2">
          <h3 className={`font-semibold text-sm ${colorClass}`}>{titulo}</h3>
          <span className="text-xs text-gray-400">{filtered.length} ítems</span>
        </div>
        <span className={`text-sm font-bold ${colorClass}`}>${fmt(total)}</span>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            {columnas.map((c) => (
              <th
                key={c.label}
                className={`px-3 py-2 font-medium text-gray-500 ${c.align === "right" ? "text-right" : "text-left"}`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map((row, i) => (
            <tr key={row.codigo} className={`border-b border-gray-50 ${i % 2 === 0 ? "" : "bg-gray-50/40"}`}>
              {columnas.map((c) => (
                <td
                  key={c.label}
                  className={`px-3 py-2 ${c.align === "right" ? "text-right" : ""} ${c.key === "codigo" ? "font-mono text-gray-400" : "text-gray-700"}`}
                >
                  {c.render ? c.render(row) : String((row as unknown as Record<string, unknown>)[c.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-200 bg-gray-50">
            <td colSpan={columnas.length - 1} className="px-3 py-2 font-semibold text-gray-700">
              Subtotal
            </td>
            <td className={`px-3 py-2 text-right font-bold ${colorClass}`}>${fmt(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default function PlanificacionPage() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [obraId, setObraId] = useState("");
  const [rubros, setRubros] = useState<string[]>([]);
  const [rubro, setRubro] = useState("");
  const [pctAvance, setPctAvance] = useState(100);
  const [data, setData] = useState<PlanificacionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Load obras
  useEffect(() => {
    fetch("/api/obras")
      .then((r) => r.json())
      .then((list: Obra[]) => {
        setObras(list);
        if (list.length > 0) setObraId(list[0].id);
      })
      .catch(() => {});
  }, []);

  // Load rubros when obra changes
  useEffect(() => {
    if (!obraId) return;
    setData(null);
    setRubro("");
    fetch(`/api/obras/${obraId}/planificacion`)
      .then((r) => r.json())
      .then((d) => {
        setRubros(d.rubros ?? []);
      })
      .catch(() => {});
  }, [obraId]);

  // Load planificacion when rubro or pct changes
  useEffect(() => {
    if (!obraId || !rubro) return;
    setLoading(true);
    setData(null);
    const params = new URLSearchParams({ rubro, pct: String(pctAvance / 100) });
    fetch(`/api/obras/${obraId}/planificacion?${params}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [obraId, rubro, pctAvance]);

  const colsMat: Col[] = [
    { label: "Código", key: "codigo" as const, align: "left" as const },
    { label: "Descripción", key: "descripcion" as const, align: "left" as const },
    { label: "Categoría", key: "categoria" as const, align: "left" as const, render: (r: InsumoAgregado) => r.categoria ?? "—" },
    { label: "Ud.", key: "unidad" as const, align: "left" as const },
    { label: "Cantidad", key: "cantidadTotal" as const, align: "right" as const, render: (r: InsumoAgregado) => fmt(r.cantidadTotal, 2) },
    { label: "P. Unit.", key: "precioUnitario" as const, align: "right" as const, render: (r: InsumoAgregado) => `$${fmt(r.precioUnitario)}` },
    { label: "Subtotal", key: "costoTotal" as const, align: "right" as const, render: (r: InsumoAgregado) => `$${fmt(r.costoTotal)}` },
  ];

  const colsMO: Col[] = [
    { label: "Código", key: "codigo" as const, align: "left" as const },
    { label: "Categoría laboral", key: "descripcion" as const, align: "left" as const },
    { label: "Jornales", key: "cantidadTotal" as const, align: "right" as const, render: (r: InsumoAgregado) => fmt(r.cantidadTotal, 2) },
    { label: "Costo jornal", key: "precioUnitario" as const, align: "right" as const, render: (r: InsumoAgregado) => `$${fmt(r.precioUnitario)}` },
    { label: "Subtotal MO", key: "costoTotal" as const, align: "right" as const, render: (r: InsumoAgregado) => `$${fmt(r.costoTotal)}` },
  ];

  const colsEQ: Col[] = [
    { label: "Código", key: "codigo" as const, align: "left" as const },
    { label: "Equipo / herramienta", key: "descripcion" as const, align: "left" as const },
    { label: "Días", key: "cantidadTotal" as const, align: "right" as const, render: (r: InsumoAgregado) => fmt(r.cantidadTotal, 2) },
    { label: "Costo/día", key: "precioUnitario" as const, align: "right" as const, render: (r: InsumoAgregado) => `$${fmt(r.precioUnitario)}` },
    { label: "Subtotal EQ", key: "costoTotal" as const, align: "right" as const, render: (r: InsumoAgregado) => `$${fmt(r.costoTotal)}` },
  ];

  const colsSub: Col[] = [
    { label: "Código", key: "codigo" as const, align: "left" as const },
    { label: "Subcontrato", key: "descripcion" as const, align: "left" as const },
    { label: "Ud.", key: "unidad" as const, align: "left" as const },
    { label: "Cantidad", key: "cantidadTotal" as const, align: "right" as const, render: (r: InsumoAgregado) => fmt(r.cantidadTotal, 2) },
    { label: "P. Unit.", key: "precioUnitario" as const, align: "right" as const, render: (r: InsumoAgregado) => `$${fmt(r.precioUnitario)}` },
    { label: "Subtotal SUB", key: "costoTotal" as const, align: "right" as const, render: (r: InsumoAgregado) => `$${fmt(r.costoTotal)}` },
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Planificación de Etapa</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Consolidá materiales, mano de obra y equipos para una etapa completa
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Obra</label>
          <select
            value={obraId}
            onChange={(e) => setObraId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 min-w-[200px]"
          >
            {obras.length === 0 && <option value="">Sin obras</option>}
            {obras.map((o) => (
              <option key={o.id} value={o.id}>{o.codigo} — {o.nombre}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Etapa / Rubro</label>
          <select
            value={rubro}
            onChange={(e) => setRubro(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 min-w-[220px]"
          >
            <option value="">— Seleccioná una etapa —</option>
            {rubros.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">% a planificar</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={100}
              value={pctAvance}
              onChange={(e) => setPctAvance(Math.min(100, Math.max(1, Number(e.target.value))))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <span className="text-sm text-gray-500">%</span>
          </div>
        </div>

        {data && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">Buscar insumo</label>
            <input
              type="text"
              placeholder="código, descripción o categoría…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
        )}
      </div>

      {/* Empty state */}
      {!rubro && !loading && (
        <div className="py-16 text-center text-gray-400">
          <p className="text-lg mb-1">Seleccioná una etapa para ver los requerimientos</p>
          <p className="text-sm">Materiales, mano de obra y equipos consolidados para toda la etapa</p>
        </div>
      )}

      {loading && (
        <div className="py-12 text-center text-gray-400">Calculando requerimientos…</div>
      )}

      {/* Results */}
      {!loading && data && data.rubro && (
        <>
          {/* KPI summary */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="bg-white border border-gray-200 rounded-xl p-4 lg:col-span-2">
              <p className="text-xs text-gray-500 mb-0.5">
                Costo Directo — {data.rubro}
                {pctAvance < 100 && <span className="text-brand-400 ml-1">({pctAvance}% de avance)</span>}
              </p>
              <p className="text-xl font-bold text-gray-900">${fmt(data.resumen.totalCD)}</p>
              {data.resumen.totalCDPpto > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {pct(data.resumen.totalCD, data.resumen.totalCDPpto)} del total del presupuesto para esta etapa
                </p>
              )}
            </div>
            <div className="bg-white border border-blue-100 rounded-xl p-4">
              <p className="text-xs text-blue-500 mb-0.5">Materiales</p>
              <p className="text-lg font-bold text-blue-700">${fmt(data.resumen.totalMat)}</p>
              <p className="text-xs text-blue-400">{pct(data.resumen.totalMat, data.resumen.totalCD)}</p>
            </div>
            <div className="bg-white border border-brand-100 rounded-xl p-4">
              <p className="text-xs text-brand-500 mb-0.5">Mano de Obra</p>
              <p className="text-lg font-bold text-brand-700">${fmt(data.resumen.totalMO)}</p>
              <p className="text-xs text-brand-400">{pct(data.resumen.totalMO, data.resumen.totalCD)}</p>
            </div>
            <div className="bg-white border border-amber-100 rounded-xl p-4">
              <p className="text-xs text-amber-500 mb-0.5">Equipos</p>
              <p className="text-lg font-bold text-amber-700">${fmt(data.resumen.totalEQ)}</p>
              <p className="text-xs text-amber-400">{pct(data.resumen.totalEQ, data.resumen.totalCD)}</p>
            </div>
          </div>

          {data.lineasSinComposicion > 0 && (
            <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 text-xs text-yellow-700">
              {data.lineasSinComposicion} de {data.lineasTotal} líneas no tienen composición APU y no fueron incluidas en el cálculo.
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

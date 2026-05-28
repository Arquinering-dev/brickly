/**
 * PresupuestoPage — solo lectura.
 * Los presupuestos se generan al importar el APU Unificado.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Upload } from "lucide-react";
import { apiFetch } from "../lib/api";

const fmtMoney = (n: number) =>
  n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const fmtNum = (n: number, dec = 2) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface PresupuestoListItem {
  id: string;
  obra: { id: string; nombre: string; codigo: string };
  tipo: "GENERADOR" | "APROBADO";
  nombre: string | null;
  version: string | null;
  mesCac: string;
  cacValor: number;
  coefGGBB: number | null;
  fecha: string;
  lineasCount: number;
  rubrosCount: number;
  totalCD: number;
  totalPV: number;
}

interface LineaDB {
  id: string;
  itemNumero: string | null;
  rubro: string;
  cantidad: string;
  precioUnitarioSnapshot: string;
  precioVenta: string | null;
  matUd: string | null; moUd: string | null; eqUd: string | null;
  fuente: string | null;
  apuLinkCodigo: string | null;
  descripcionLibre: string | null;
  partida: { id: string; codigo: string; descripcion: string; unidad: string } | null;
}

// ─── Raíz ─────────────────────────────────────────────────────────────────────

export default function PresupuestoPage() {
  const { id } = useParams<{ id: string }>();
  if (id) return <PresupuestoDetalle headerId={id} />;
  return <PresupuestoLista />;
}

// ─── Lista ────────────────────────────────────────────────────────────────────

function PresupuestoLista() {
  const navigate = useNavigate();
  const [items, setItems] = useState<PresupuestoListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchList = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch("/api/presupuestos");
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, []);
  useEffect(() => { fetchList(); }, [fetchList]);

  const eliminar = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("¿Eliminar este presupuesto? Esta acción es irreversible.")) return;
    await apiFetch(`/api/presupuestos/${id}`, { method: "DELETE" });
    fetchList();
  };

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-stone-900">Presupuestos</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Generados al importar el APU Unificado.
          </p>
        </div>
        <button
          onClick={() => navigate("/catalogo/importar")}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-500 text-white rounded-lg text-sm font-semibold hover:bg-brand-600 shadow-sm"
        >
          <Upload className="h-4 w-4" />
          Importar APU
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-stone-400 text-sm">Cargando…</div>
      ) : items.length === 0 ? (
        <div className="py-20 text-center space-y-3">
          <p className="text-stone-400 text-sm">Todavía no hay presupuestos.</p>
          <button
            onClick={() => navigate("/catalogo/importar")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-semibold hover:bg-brand-600"
          >
            <Upload className="h-4 w-4" />
            Importar APU Unificado
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate(`/catalogo/presupuestos/${p.id}`)}
              className="text-left bg-white rounded-2xl border border-stone-200 shadow-sm hover:shadow-md hover:border-brand-300 transition-all p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  p.tipo === "APROBADO" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                }`}>
                  {p.tipo}
                </span>
                <span className="text-xs text-stone-400 font-mono">{p.obra.codigo}</span>
              </div>
              <p className="text-base font-bold text-stone-900 mb-1 truncate">{p.obra.nombre}</p>
              <p className="text-xs text-stone-500 mb-1">{p.nombre || "—"}</p>
              <p className="text-xs text-stone-400 mb-4">Mes base: {p.mesCac || "—"}{p.coefGGBB ? ` · GGBB ×${p.coefGGBB}` : ""}</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-stone-400">Costo directo</p>
                  <p className="font-bold text-stone-800">{fmtMoney(p.totalCD)}</p>
                </div>
                <div>
                  <p className="text-stone-400">Precio venta</p>
                  <p className="font-bold text-stone-800">{p.totalPV > 0 ? fmtMoney(p.totalPV) : "—"}</p>
                </div>
                <div>
                  <p className="text-stone-400">Ítems</p>
                  <p className="font-medium text-stone-700">{p.lineasCount}</p>
                </div>
                <div>
                  <p className="text-stone-400">Rubros</p>
                  <p className="font-medium text-stone-700">{p.rubrosCount}</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-stone-100 flex justify-end">
                <span
                  onClick={(e) => eliminar(p.id, e)}
                  className="text-xs text-red-400 hover:text-red-600 cursor-pointer"
                >
                  Eliminar
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Detalle ──────────────────────────────────────────────────────────────────

function PresupuestoDetalle({ headerId }: { headerId: string }) {
  const navigate = useNavigate();
  const [lineas, setLineas] = useState<LineaDB[]>([]);
  const [header, setHeader] = useState<PresupuestoListItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/presupuestos/${headerId}`)
      .then(r => r.json())
      .then(data => { setLineas(data.lineas ?? []); setHeader(data); setLoading(false); });
  }, [headerId]);

  const rubros = useMemo(() => {
    const m = new Map<string, { total: number; lineas: LineaDB[] }>();
    for (const l of lineas) {
      const r = l.rubro || "GENERAL";
      const g = m.get(r) ?? { total: 0, lineas: [] };
      g.lineas.push(l);
      g.total += Number(l.cantidad) * Number(l.precioUnitarioSnapshot);
      m.set(r, g);
    }
    return [...m.entries()].map(([nombre, v]) => ({ nombre, ...v }));
  }, [lineas]);

  const totalCD = rubros.reduce((s, r) => s + r.total, 0);

  if (loading) return <div className="p-8 text-stone-400">Cargando…</div>;

  return (
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/catalogo/presupuestos")} className="text-stone-400 hover:text-stone-700 text-sm">
          ← Presupuestos
        </button>
        <span className="text-stone-300">/</span>
        <div>
          <h1 className="text-xl font-bold text-stone-900">{header?.obra.nombre}</h1>
          <p className="text-xs text-stone-400">
            {header?.tipo} · {header?.mesCac}{header?.coefGGBB ? ` · GGBB ×${header.coefGGBB}` : ""}
          </p>
        </div>
      </div>

      {/* Totales */}
      <div className="bg-gradient-to-br from-stone-900 to-stone-800 text-white rounded-2xl p-5 mb-6 grid grid-cols-3 gap-6">
        <div>
          <p className="text-xs uppercase text-stone-400 mb-1">Ítems</p>
          <p className="text-2xl font-black">{lineas.length}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-stone-400 mb-1">Costo directo</p>
          <p className="text-2xl font-black">{fmtMoney(totalCD)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-stone-400 mb-1">Rubros</p>
          <p className="text-2xl font-black">{rubros.length}</p>
        </div>
      </div>

      {/* Tabla por rubros */}
      {rubros.map((r) => (
        <RubroSection key={r.nombre} nombre={r.nombre} total={r.total} lineas={r.lineas} />
      ))}
    </div>
  );
}

function RubroSection({ nombre, total, lineas }: { nombre: string; total: number; lineas: LineaDB[] }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-3 bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-3 bg-stone-50 border-b border-stone-100 flex items-center justify-between hover:bg-stone-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-stone-400">{open ? "▼" : "▶"}</span>
          <h3 className="font-bold text-stone-800 text-sm uppercase">{nombre}</h3>
          <span className="text-xs text-stone-400">({lineas.length})</span>
        </div>
        <span className="text-sm font-semibold text-stone-700">{fmtMoney(total)}</span>
      </button>

      {open && (
        <table className="w-full text-sm">
          <thead className="text-xs text-stone-500 border-b border-stone-100">
            <tr>
              <th className="text-left px-4 py-2 font-medium w-14">Item</th>
              <th className="text-left px-4 py-2 font-medium">Descripción</th>
              <th className="text-left px-4 py-2 font-medium w-12">Ud</th>
              <th className="text-right px-4 py-2 font-medium w-20">Cant</th>
              <th className="text-right px-4 py-2 font-medium w-36">P. Unit CD</th>
              <th className="text-right px-4 py-2 font-medium w-36">Total CD</th>
              <th className="text-left px-4 py-2 font-medium w-24">Fuente</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l) => {
              const cant = Number(l.cantidad);
              const pu   = Number(l.precioUnitarioSnapshot);
              const desc = l.partida?.descripcion ?? l.descripcionLibre ?? "—";
              return (
                <tr key={l.id} className="border-b border-stone-50 hover:bg-stone-50/50">
                  <td className="px-4 py-2 font-mono text-xs text-stone-500">{l.itemNumero}</td>
                  <td className="px-4 py-2 text-stone-800 max-w-sm">
                    <span className="block truncate" title={desc}>{desc}</span>
                    {l.apuLinkCodigo && (
                      <span className="text-xs font-mono text-stone-400">{l.apuLinkCodigo}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-stone-500">
                    {l.partida?.unidad ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-right text-xs tabular-nums">{fmtNum(cant)}</td>
                  <td className="px-4 py-2 text-right text-xs tabular-nums">{fmtMoney(pu)}</td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums">{fmtMoney(cant * pu)}</td>
                  <td className="px-4 py-2">
                    {l.fuente === "APU" ? (
                      <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-medium">APU</span>
                    ) : (
                      <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded">Manual</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

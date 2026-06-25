/**
 * PresupuestoPage — solo lectura.
 * Los presupuestos se generan al importar el Resumen de Obra.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Upload } from "lucide-react";
import { apiFetch } from "../lib/api";

const fmtMoney = (n: number) =>
  n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const fmtNum = (n: number, dec = 0) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface IccInfo {
  base: number;
  actual: number | null;
  coef: number | null;
  mesBase: string | null;
  mesActual: string | null;
  variacionMensual: number | null;
}

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
  icc?: IccInfo;
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
  if (id === "nuevo") return <NuevoPresupuesto />;
  if (id) return <PresupuestoDetalle headerId={id} />;
  return <PresupuestoLista />;
}

// ─── Nuevo ────────────────────────────────────────────────────────────────────

function NuevoPresupuesto() {
  const navigate = useNavigate();
  const [obras, setObras] = useState<{ id: string; nombre: string; codigo: string }[]>([]);
  const [obraId, setObraId] = useState("");
  const [tipo, setTipo] = useState<"GENERADOR" | "APROBADO">("GENERADOR");
  const [nombre, setNombre] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/obras").then(r => r.json()).then((data: { id: string; nombre: string; codigo: string }[]) => {
      setObras(data);
      if (data.length === 1) setObraId(data[0].id);
    }).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!obraId) { setError("Seleccioná una obra"); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch("/api/presupuestos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ obraId, tipo, nombre: nombre.trim() || undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? "Error al crear");
      }
      const created = await res.json() as { id: string };
      navigate(`/catalogo/presupuestos/${created.id}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
      setSaving(false);
    }
  }

  return (
    <div className="p-8 max-w-lg">
      <button onClick={() => navigate(-1)} className="text-sm text-stone-400 hover:text-stone-700 mb-6 flex items-center gap-1">
        ← Volver
      </button>
      <h1 className="text-2xl font-black text-stone-900 mb-1">Nuevo presupuesto</h1>
      <p className="text-sm text-stone-500 mb-6">Crea un presupuesto vacío. Para importar desde Excel usá <button onClick={() => navigate("/catalogo/importar")} className="underline text-brand-600">Importar Resumen de Obra</button>.</p>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white border border-stone-200 rounded-2xl p-6">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">Obra <span className="text-red-500">*</span></label>
          <select
            value={obraId}
            onChange={e => setObraId(e.target.value)}
            className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
            required
          >
            <option value="">— Seleccionar obra —</option>
            {obras.map(o => (
              <option key={o.id} value={o.id}>{o.codigo} · {o.nombre}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">Tipo</label>
          <div className="flex gap-3">
            {(["GENERADOR", "APROBADO"] as const).map(t => (
              <label key={t} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="tipo" value={t} checked={tipo === t} onChange={() => setTipo(t)} className="accent-brand-600" />
                <span className="text-sm text-stone-700">{t === "GENERADOR" ? "Generador" : "Aprobado"}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">Nombre <span className="text-stone-400 font-normal">(opcional)</span></label>
          <input
            type="text"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="Ej: Versión 1 — Oferta inicial"
            className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
          />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving || !obraId}
            className="flex-1 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-semibold hover:bg-brand-700 disabled:opacity-40"
          >
            {saving ? "Creando…" : "Crear presupuesto"}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="px-4 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-600 hover:bg-stone-50">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
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
            Generados al importar el Resumen de Obra.
          </p>
        </div>
        <button
          onClick={() => navigate("/catalogo/importar")}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-500 text-white rounded-lg text-sm font-semibold hover:bg-brand-600 shadow-sm"
        >
          <Upload className="h-4 w-4" />
          Importar Resumen
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
            Importar Resumen de Obra
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
              <p className="text-xs text-stone-400 mb-3">Mes base: {p.mesCac || "—"}{p.coefGGBB ? ` · GGBB ×${p.coefGGBB}` : ""}</p>
              {/* Bloque ICC */}
              {p.icc?.coef != null ? (
                <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold">Actualizado ICC</span>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">×{p.icc.coef.toFixed(3)}</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-base font-black text-stone-900">{fmtMoney(p.totalPV > 0 ? p.totalPV * p.icc.coef : p.totalCD * p.icc.coef)}</p>
                    <p className="text-[10px] text-stone-400 line-through">{fmtMoney(p.totalPV > 0 ? p.totalPV : p.totalCD)}</p>
                  </div>
                  <p className="text-[10px] text-stone-400 mt-0.5">{p.icc.mesBase} → {p.icc.mesActual}</p>
                </div>
              ) : p.icc?.variacionMensual != null ? (
                <div className="mb-3 bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-2 text-[10px] text-stone-500">
                  ICC {p.icc.mesActual}: +{p.icc.variacionMensual.toFixed(1)}% mensual · valor absoluto no disponible
                </div>
              ) : null}
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
  const [header, setHeader] = useState<PresupuestoListItem & { icc?: IccInfo } | null>(null);
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
      <div className="bg-gradient-to-br from-stone-900 to-stone-800 text-white rounded-2xl p-5 mb-4 grid grid-cols-3 gap-6">
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

      {/* Bloque ICC — precio base vs actualizado */}
      {header?.icc && (
        header.icc.coef != null ? (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-amber-700 font-semibold">Precio actualizado por ICC · INDEC</p>
                <p className="text-[10px] text-amber-600 mt-0.5">{header.icc.mesBase} → {header.icc.mesActual}</p>
              </div>
              <span className="text-sm font-black text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
                ×{header.icc.coef.toFixed(3)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] uppercase text-stone-400 mb-0.5">Costo directo actualizado</p>
                <p className="text-xl font-black text-stone-900">{fmtMoney(totalCD * header.icc.coef)}</p>
                <p className="text-xs text-stone-400 line-through mt-0.5">{fmtMoney(totalCD)}</p>
              </div>
              {header.cacValor > 0 && (
                <div>
                  <p className="text-[10px] uppercase text-stone-400 mb-0.5">ICC base del presupuesto</p>
                  <p className="text-xl font-black text-stone-900">{fmtNum(header.cacValor)}</p>
                  <p className="text-xs text-stone-400 mt-0.5">actual: {fmtNum(header.icc.actual ?? 0)}</p>
                </div>
              )}
            </div>
          </div>
        ) : header.icc.variacionMensual != null ? (
          <div className="mb-4 bg-stone-50 border border-stone-200 rounded-2xl p-3 text-xs text-stone-500">
            ICC {header.icc.mesActual}: +{header.icc.variacionMensual.toFixed(1)}% mensual ·
            {header.cacValor > 0
              ? " valor absoluto actual no disponible aún (se obtiene del FTP INDEC)."
              : " importá el presupuesto nuevamente para capturar el valor base del ICC."}
          </div>
        ) : null
      )}

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

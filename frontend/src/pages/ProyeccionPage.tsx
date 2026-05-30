/**
 * ProyeccionPage — Qué insumos se necesitan, cuándo, y consolidado entre obras.
 * Solo lectura. Se calcula desde el plan congelado (presupuesto + cronograma) de cada obra.
 * Cubre únicamente ítems con composición APU; las cotizaciones directas no se desglosan.
 */
import { useEffect, useMemo, useState } from "react";
import { Search, Boxes, AlertTriangle, Package, HardHat, Wrench, FileText } from "lucide-react";
import { apiFetch } from "../lib/api";
import { fmtMoney, fmtNum, fmtPct } from "../lib/format";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty";
import { cn } from "../lib/cn";

interface Celda { cantidad: number; monto: number }
interface InsumoProy {
  codigo: string;
  descripcion: string;
  tipo: "MATERIAL" | "MANO_DE_OBRA" | "EQUIPO" | "SUBCONTRATO";
  unidad: string;
  categoria: string | null;
  porMes: Record<string, Celda>;
  totalCantidad: number;
  totalMonto: number;
}
interface Mes { mes: string; fecha: string; label: string }
interface ProyeccionData {
  obras: { id: string; nombre: string; codigo: string }[];
  obrasConDatos: string[];
  meses: Mes[];
  insumos: InsumoProy[];
  totalMontoPorMes: Record<string, number>;
  cobertura: { cdConComposicion: number; cdTotal: number; pct: number };
}

const TIPOS = [
  { key: "", label: "Todos", icon: Boxes },
  { key: "MATERIAL", label: "Materiales", icon: Package },
  { key: "MANO_DE_OBRA", label: "Mano de obra", icon: HardHat },
  { key: "EQUIPO", label: "Equipos", icon: Wrench },
  { key: "SUBCONTRATO", label: "Subcontratos", icon: FileText },
] as const;

const TIPO_BADGE: Record<string, string> = {
  MATERIAL: "bg-blue-50 text-blue-600",
  MANO_DE_OBRA: "bg-amber-50 text-amber-600",
  EQUIPO: "bg-violet-50 text-violet-600",
  SUBCONTRATO: "bg-teal-50 text-teal-600",
};

// Cantidad: 0 decimales si es grande, 2 si es chica.
const fmtCant = (n: number) => fmtNum(n, n >= 100 ? 0 : 2);

export default function ProyeccionPage() {
  const [data, setData] = useState<ProyeccionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [obraId, setObraId] = useState("");
  const [tipo, setTipo] = useState("");
  const [search, setSearch] = useState("");
  const [modo, setModo] = useState<"cantidad" | "monto">("cantidad");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (obraId) params.set("obraId", obraId);
    if (tipo) params.set("tipo", tipo);
    apiFetch(`/api/insumos/proyeccion?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ProyeccionData | null) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [obraId, tipo]);

  // Meses "próximos" = mes calendario actual + siguiente (para resaltar la ventana de compra)
  const mesesProximos = useMemo(() => {
    const hoy = new Date();
    const m0 = hoy.toISOString().slice(0, 7);
    const sig = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1).toISOString().slice(0, 7);
    return new Set([m0, sig]);
  }, []);

  const insumosFiltrados = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.insumos;
    return data.insumos.filter(
      (i) => i.codigo.toLowerCase().includes(q) || i.descripcion.toLowerCase().includes(q),
    );
  }, [data, search]);

  // Resumen "próximos 2 meses": top insumos por monto en la ventana actual+siguiente
  const proximos = useMemo(() => {
    if (!data) return { total: 0, top: [] as { ins: InsumoProy; cantidad: number; monto: number }[] };
    let total = 0;
    const rows = data.insumos.map((ins) => {
      let cantidad = 0, monto = 0;
      for (const m of mesesProximos) {
        const c = ins.porMes[m];
        if (c) { cantidad += c.cantidad; monto += c.monto; }
      }
      total += monto;
      return { ins, cantidad, monto };
    }).filter((r) => r.monto > 0).sort((a, b) => b.monto - a.monto);
    return { total, top: rows.slice(0, 6) };
  }, [data, mesesProximos]);

  if (loading && !data) return <ProyeccionSkeleton />;
  if (!data) return <div className="p-8 text-stone-500">Error al cargar la proyección</div>;

  const hayDatos = data.meses.length > 0 && data.insumos.length > 0;

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2">
          <Boxes className="h-6 w-6 text-brand-600" /> Proyección de insumos
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Qué materiales, mano de obra y equipos prevé el plan de cada obra, mes a mes y consolidado.
          Para anticipar compras — no es consumo real.
        </p>
      </div>

      {/* Cobertura honesta */}
      <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 p-3">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 leading-relaxed">
          La proyección cubre <strong>{fmtPct(data.cobertura.pct)}</strong> del costo directo
          ({fmtMoney(data.cobertura.cdConComposicion, { compact: true })} de {fmtMoney(data.cobertura.cdTotal, { compact: true })}):
          solo los ítems con composición APU se desglosan en insumos. El resto son cotizaciones
          directas (muchos subcontratos, equipos y mano de obra) que no se abren en cantidades.
        </p>
      </div>

      {/* Filtros */}
      <div className="space-y-3">
        {/* Obras */}
        <div className="flex gap-2 flex-wrap">
          <FilterPill active={obraId === ""} onClick={() => setObraId("")}>Todas las obras</FilterPill>
          {data.obras.map((o) => (
            <FilterPill key={o.id} active={obraId === o.id} onClick={() => setObraId(o.id)}
              disabled={!data.obrasConDatos.includes(o.id) && obraId !== o.id}>
              {o.codigo}
            </FilterPill>
          ))}
        </div>
        {/* Tipos + búsqueda + modo */}
        <div className="flex gap-2 flex-wrap items-center">
          {TIPOS.map((t) => (
            <FilterPill key={t.key} active={tipo === t.key} onClick={() => setTipo(t.key)}>
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </FilterPill>
          ))}
          <div className="relative ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <Input placeholder="Buscar insumo…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-56" />
          </div>
          <div className="flex rounded-lg border border-stone-200 overflow-hidden">
            {(["cantidad", "monto"] as const).map((m) => (
              <button key={m} onClick={() => setModo(m)}
                className={cn("px-3 py-2 text-xs font-medium transition-colors",
                  modo === m ? "bg-brand-700 text-white" : "bg-white text-stone-600 hover:bg-stone-50")}>
                {m === "cantidad" ? "Cantidad" : "Costo $"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!hayDatos ? (
        <EmptyState
          icon={Boxes}
          title="Sin datos para proyectar"
          description="Las obras necesitan un presupuesto con partidas APU y un cronograma cargado para proyectar insumos."
        />
      ) : (
        <>
          {/* Ventana de compra: próximos 2 meses */}
          {proximos.top.length > 0 && (
            <Card className="p-5 bg-gradient-to-br from-brand-50 to-stone-50 border-brand-200/60">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div>
                  <h3 className="font-bold text-stone-900 text-sm">Para anticipar — próximos 2 meses</h3>
                  <p className="text-2xs text-stone-500">Insumos con mayor necesidad en el mes actual y el siguiente</p>
                </div>
                <div className="text-right">
                  <p className="text-2xs uppercase tracking-wide text-stone-400">Costo estimado</p>
                  <p className="text-lg font-black text-brand-700">{fmtMoney(proximos.total, { compact: true })}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {proximos.top.map((r) => (
                  <div key={r.ins.codigo} className="bg-white rounded-lg border border-stone-200/60 p-3">
                    <p className="text-xs font-semibold text-stone-800 truncate" title={r.ins.descripcion}>{r.ins.descripcion}</p>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="text-sm font-bold text-stone-900">{fmtCant(r.cantidad)} <span className="text-2xs font-normal text-stone-400">{r.ins.unidad}</span></span>
                      <span className="text-2xs text-stone-500">{fmtMoney(r.monto, { compact: true })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Matriz insumo × mes */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200">
                    <th className="text-left px-4 py-2.5 font-medium text-stone-500 text-2xs uppercase tracking-wider sticky left-0 bg-stone-50 z-10 min-w-[280px]">
                      Insumo
                    </th>
                    {data.meses.map((m) => (
                      <th key={m.mes} className={cn("text-right px-3 py-2.5 font-medium text-2xs uppercase tracking-wider whitespace-nowrap min-w-[80px]",
                        mesesProximos.has(m.mes) ? "bg-brand-50 text-brand-700" : "text-stone-500")}>
                        {m.label}
                      </th>
                    ))}
                    <th className="text-right px-4 py-2.5 font-medium text-stone-500 text-2xs uppercase tracking-wider sticky right-0 bg-stone-50 min-w-[100px]">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {insumosFiltrados.map((ins) => (
                    <tr key={ins.codigo} className="border-b border-stone-50 hover:bg-stone-50/40">
                      <td className="px-4 py-2 sticky left-0 bg-white">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={cn("text-2xs px-1.5 py-0.5 rounded font-medium shrink-0", TIPO_BADGE[ins.tipo])}>{ins.unidad}</span>
                          <span className="text-xs text-stone-800 truncate max-w-[220px]" title={`${ins.codigo} · ${ins.descripcion}`}>{ins.descripcion}</span>
                        </div>
                      </td>
                      {data.meses.map((m) => {
                        const c = ins.porMes[m.mes];
                        const val = c ? (modo === "cantidad" ? c.cantidad : c.monto) : 0;
                        return (
                          <td key={m.mes} className={cn("px-3 py-2 text-right tabular-nums text-xs",
                            mesesProximos.has(m.mes) && "bg-brand-50/40",
                            val ? "text-stone-800" : "text-stone-300")}>
                            {val ? (modo === "cantidad" ? fmtCant(val) : fmtMoney(val, { compact: true })) : "·"}
                          </td>
                        );
                      })}
                      <td className="px-4 py-2 text-right font-bold tabular-nums text-xs sticky right-0 bg-white">
                        {modo === "cantidad" ? fmtCant(ins.totalCantidad) : fmtMoney(ins.totalMonto, { compact: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-stone-900 text-white">
                    <td className="px-4 py-2.5 text-2xs uppercase tracking-wider font-semibold sticky left-0 bg-stone-900">Costo total / mes</td>
                    {data.meses.map((m) => (
                      <td key={m.mes} className={cn("px-3 py-2.5 text-right tabular-nums text-xs font-semibold", mesesProximos.has(m.mes) && "text-brand-200")}>
                        {fmtMoney(data.totalMontoPorMes[m.mes] ?? 0, { compact: true })}
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs font-black sticky right-0 bg-stone-900">
                      {fmtMoney(Object.values(data.totalMontoPorMes).reduce((s, v) => s + v, 0), { compact: true })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {insumosFiltrados.length === 0 && (
              <div className="py-10 text-center text-stone-400 text-sm">Ningún insumo coincide con la búsqueda.</div>
            )}
          </Card>
          <p className="text-2xs text-stone-400">
            {insumosFiltrados.length} insumos · {data.meses.length} meses · columnas resaltadas = mes actual y siguiente
          </p>
        </>
      )}
    </div>
  );
}

function FilterPill({ active, onClick, disabled, children }: {
  active: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border",
        active ? "bg-brand-700 text-white border-brand-700 shadow-sm"
          : disabled ? "bg-stone-50 text-stone-300 border-stone-100 cursor-not-allowed"
          : "bg-white text-stone-600 border-stone-200 hover:border-stone-300 hover:bg-stone-50",
      )}>
      {children}
    </button>
  );
}

function ProyeccionSkeleton() {
  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-5">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-12 rounded-xl" />
      <Skeleton className="h-10 w-full max-w-2xl rounded-lg" />
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}

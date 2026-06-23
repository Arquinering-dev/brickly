/**
 * ProyeccionPage — Qué insumos se necesitan, cuándo, y consolidado entre obras.
 * Solo lectura. Se calcula desde el plan congelado (presupuesto + cronograma) de cada obra.
 * Cubre únicamente ítems con composición APU; las cotizaciones directas no se desglosan.
 *
 * Dos vistas:
 *   - Totales: insumos agrupados por Tipo → Categoría, con cantidad/costo/estado/período.
 *   - Cronograma: la misma agrupación pero como matriz insumo × mes.
 * La categoría sale de Insumo.categoriaCanonica (asignada por IA al importar).
 */
import { useEffect, useMemo, useState } from "react";
import {
  Search, Boxes, AlertTriangle, Package, HardHat, Wrench, FileText,
  ChevronRight, ChevronDown, LayoutGrid, List, X, Check, ListFilter,
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { fmtMoney, fmtNum } from "../lib/format";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "../components/ui/dropdown-menu";
import { cn } from "../lib/cn";

interface Celda { cantidad: number; monto: number }
interface InsumoProy {
  codigo: string;
  descripcion: string;
  tipo: "MATERIAL" | "MANO_DE_OBRA" | "EQUIPO" | "SUBCONTRATO";
  unidad: string;
  categoria: string | null;
  precioUnitario: number;
  porMes: Record<string, Celda>;
  porRubro: Record<string, Celda>;
  totalCantidad: number;
  totalMonto: number;
}
interface Mes { mes: string; fecha: string; label: string }
interface IccData {
  mes: number; anio: number; mesLabel: string;
  variacionMensual: number | null;
  variacionAnual: number | null;
  valorAbsoluto: number | null;
}
interface ProyeccionData {
  obras: { id: string; nombre: string; codigo: string }[];
  obrasConDatos: string[];
  meses: Mes[];
  rubros: string[];
  insumos: InsumoProy[];
  totalMontoPorMes: Record<string, number>;
  cobertura: { cdConComposicion: number; cdTotal: number; pct: number };
  icc: IccData | null;
}

const TIPOS = [
  { key: "", label: "Todo", icon: Boxes },
  { key: "MATERIAL", label: "Materiales", icon: Package },
  { key: "SUBCONTRATO", label: "Subcontratos", icon: FileText },
  { key: "MANO_DE_OBRA", label: "Mano de obra", icon: HardHat },
  { key: "EQUIPO", label: "Equipos", icon: Wrench },
] as const;

const TIPO_ORDER = ["MATERIAL", "SUBCONTRATO", "EQUIPO", "MANO_DE_OBRA"] as const;
const TIPO_META: Record<string, { label: string; dot: string; badge: string; short: string }> = {
  MATERIAL:     { label: "Materiales",   dot: "bg-blue-500",   badge: "bg-blue-50 text-blue-600",     short: "MAT" },
  SUBCONTRATO:  { label: "Subcontratos", dot: "bg-teal-500",   badge: "bg-teal-50 text-teal-600",     short: "SUB" },
  EQUIPO:       { label: "Equipos",      dot: "bg-violet-500", badge: "bg-violet-50 text-violet-600", short: "EQ"  },
  MANO_DE_OBRA: { label: "Mano de obra", dot: "bg-amber-500",  badge: "bg-amber-50 text-amber-600",   short: "MO"  },
};

type Estado = "EN CURSO" | "PRÓXIMO" | "FUTURO" | "PASADO" | null;
const ESTADO_BADGE: Record<string, string> = {
  "EN CURSO": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "PRÓXIMO":  "bg-amber-50 text-amber-700 border-amber-200",
  "FUTURO":   "bg-stone-100 text-stone-500 border-stone-200",
  "PASADO":   "bg-rose-50 text-rose-600 border-rose-200",
};

const MESES_ABBR = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const fmtMesCorto = (ym: string) => {
  const [y, m] = ym.split("-");
  return `${MESES_ABBR[+m - 1] ?? m}'${y.slice(2)}`;
};
const fmtCant = (n: number) => fmtNum(n, n >= 100 ? 0 : 2);

interface InsumoView extends InsumoProy { _min: string | null; _max: string | null; _estado: Estado; _urgente: boolean }

function metaInsumo(ins: InsumoProy, m0: string, m1: string): Pick<InsumoView, "_min" | "_max" | "_estado" | "_urgente"> {
  const meses = Object.keys(ins.porMes).filter((k) => ins.porMes[k].cantidad > 0).sort();
  if (meses.length === 0) return { _min: null, _max: null, _estado: null, _urgente: false };
  const min = meses[0], max = meses[meses.length - 1];
  let estado: Estado;
  if (min <= m0 && max >= m0) estado = "EN CURSO";
  else if (max < m0) estado = "PASADO";
  else if (min <= m1) estado = "PRÓXIMO";
  else estado = "FUTURO";
  return { _min: min, _max: max, _estado: estado, _urgente: estado === "EN CURSO" || estado === "PRÓXIMO" };
}

function aggItems(items: InsumoView[]) {
  let monto = 0;
  const porMes: Record<string, Celda> = {};
  for (const i of items) {
    monto += i.totalMonto;
    for (const [m, c] of Object.entries(i.porMes)) {
      const t = porMes[m] ?? (porMes[m] = { cantidad: 0, monto: 0 });
      t.cantidad += c.cantidad; t.monto += c.monto;
    }
  }
  return { monto, count: items.length, porMes };
}

export default function ProyeccionPage() {
  const [data, setData] = useState<ProyeccionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [obraId, setObraId] = useState("");
  const [tipo, setTipo] = useState("");
  const [rubrosSel, setRubrosSel] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [modo, setModo] = useState<"cantidad" | "monto">("monto");
  const [vista, setVista] = useState<"totales" | "cronograma">("totales");
  const [orden, setOrden] = useState<"urgencia" | "costo" | "nombre">("costo");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<InsumoView | null>(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (obraId) params.set("obraId", obraId);
    if (tipo) params.set("tipo", tipo);
    if (rubrosSel.length) params.set("rubros", rubrosSel.join("|"));
    apiFetch(`/api/insumos/proyeccion?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ProyeccionData | null) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [obraId, tipo, rubrosSel]);

  const { m0, m1, mesesProximos } = useMemo(() => {
    const hoy = new Date();
    const a = hoy.toISOString().slice(0, 7);
    const b = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1).toISOString().slice(0, 7);
    return { m0: a, m1: b, mesesProximos: new Set([a, b]) };
  }, []);

  // Insumos con metadata (estado/período) + filtro por búsqueda + orden
  const insumosView = useMemo<InsumoView[]>(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    const arr = data.insumos
      .filter((i) => !q || i.codigo.toLowerCase().includes(q) || i.descripcion.toLowerCase().includes(q))
      .map((i) => ({ ...i, ...metaInsumo(i, m0, m1) }));
    arr.sort((a, b) => {
      if (orden === "costo") return b.totalMonto - a.totalMonto;
      if (orden === "nombre") return a.descripcion.localeCompare(b.descripcion, "es");
      if (a._urgente !== b._urgente) return a._urgente ? -1 : 1;
      const am = a._min ?? "9999", bm = b._min ?? "9999";
      if (am !== bm) return am.localeCompare(bm);
      return b.totalMonto - a.totalMonto;
    });
    return arr;
  }, [data, search, orden, m0, m1]);

  // Agrupación Tipo → Categoría
  const grupos = useMemo(() => {
    return TIPO_ORDER.map((t) => {
      const ins = insumosView.filter((i) => i.tipo === t);
      if (ins.length === 0) return null;
      const catMap = new Map<string, InsumoView[]>();
      for (const i of ins) {
        const c = i.categoria || "Sin categoría";
        const list = catMap.get(c) ?? catMap.set(c, []).get(c)!;
        list.push(i);
      }
      const cats = [...catMap.entries()]
        .map(([categoria, items]) => ({ categoria, items, ...aggItems(items) }))
        .sort((a, b) => b.monto - a.monto);
      return { tipo: t, cats, ...aggItems(ins) };
    }).filter(Boolean) as {
      tipo: string; cats: { categoria: string; items: InsumoView[]; monto: number; count: number; porMes: Record<string, Celda> }[];
      monto: number; count: number; porMes: Record<string, Celda>;
    }[];
  }, [insumosView]);

  const stats = useMemo(() => {
    const cats = new Set(insumosView.map((i) => i.categoria || "Sin categoría"));
    return {
      items: insumosView.length,
      total: insumosView.reduce((s, i) => s + i.totalMonto, 0),
      categorias: cats.size,
      urgentes: insumosView.filter((i) => i._urgente).length,
    };
  }, [insumosView]);

  const allKeys = useMemo(
    () => grupos.flatMap((g) => [g.tipo, ...g.cats.map((c) => `${g.tipo}::${c.categoria}`)]),
    [grupos],
  );
  const isOpen = (k: string) => !collapsed.has(k);
  const toggle = (k: string) =>
    setCollapsed((prev) => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const toggleAll = () => setCollapsed((prev) => (prev.size > 0 ? new Set() : new Set(allKeys)));

  if (loading && !data) return <ProyeccionSkeleton />;
  if (!data) return <div className="p-8 text-stone-500">Error al cargar la proyección</div>;

  const hayDatos = data.meses.length > 0 && insumosView.length > 0;

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2">
          <Boxes className="h-6 w-6 text-brand-600" /> Proyección de insumos
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Consolidá insumos por etapa — materiales, mano de obra y subcontratos. Para anticipar
          compras — no es consumo real.
        </p>
      </div>

      {/* Cobertura honesta */}
      <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 p-3">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 leading-relaxed">
          La proyección cubre <strong>{(data.cobertura.pct * 100).toFixed(0)}%</strong> del costo directo
          ({fmtMoney(data.cobertura.cdConComposicion, { compact: true })} de {fmtMoney(data.cobertura.cdTotal, { compact: true })}):
          solo los ítems con composición APU se desglosan en insumos.
        </p>
      </div>

      {/* Filtros */}
      <div className="space-y-3">
        {/* Alcance: obras */}
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-2xs uppercase tracking-wider text-stone-400 font-semibold mr-1">Alcance</span>
          <FilterPill active={obraId === ""} onClick={() => setObraId("")}>Todas las obras</FilterPill>
          {data.obras.map((o) => (
            <FilterPill key={o.id} active={obraId === o.id} onClick={() => setObraId(o.id)}
              disabled={!data.obrasConDatos.includes(o.id) && obraId !== o.id}>
              {o.codigo}
            </FilterPill>
          ))}
        </div>
        {/* Tipo + rubro + búsqueda */}
        <div className="flex gap-2 flex-wrap items-center">
          {TIPOS.map((t) => (
            <FilterPill key={t.key} active={tipo === t.key} onClick={() => setTipo(t.key)}>
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </FilterPill>
          ))}
          <RubroFilter rubros={data.rubros} selected={rubrosSel} onChange={setRubrosSel} />
          <div className="relative ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <Input placeholder="Buscar insumo…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-56" />
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
          {/* Stats + controles de vista */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              <StatChip>{stats.items} ítems</StatChip>
              <StatChip>{fmtMoney(stats.total, { compact: true })} total</StatChip>
              <StatChip>{stats.categorias} categorías</StatChip>
              <StatChip tone="warn">{stats.urgentes} urgentes/en curso</StatChip>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-2xs uppercase tracking-wider text-stone-400 font-semibold">Ordenar</span>
                {(["urgencia", "costo", "nombre"] as const).map((o) => (
                  <button key={o} onClick={() => setOrden(o)}
                    className={cn("px-2.5 py-1 text-xs font-medium rounded-md capitalize transition-colors",
                      orden === o ? "bg-stone-900 text-white" : "text-stone-500 hover:bg-stone-100")}>
                    {o}
                  </button>
                ))}
              </div>
              <button onClick={toggleAll} className="text-xs text-stone-500 hover:text-stone-800 hover:bg-stone-100 px-2.5 py-1.5 rounded-md font-medium">
                {collapsed.size > 0 ? "Expandir todo" : "Contraer todo"}
              </button>
              {/* Toggle de vista */}
              <div className="flex rounded-lg border border-stone-200 overflow-hidden">
                <button onClick={() => setVista("totales")} title="Vista de totales"
                  className={cn("px-2.5 py-2 transition-colors", vista === "totales" ? "bg-brand-700 text-white" : "bg-white text-stone-500 hover:bg-stone-50")}>
                  <List className="h-4 w-4" />
                </button>
                <button onClick={() => setVista("cronograma")} title="Vista cronograma"
                  className={cn("px-2.5 py-2 transition-colors", vista === "cronograma" ? "bg-brand-700 text-white" : "bg-white text-stone-500 hover:bg-stone-50")}>
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {vista === "totales"
            ? <TotalesTable grupos={grupos} isOpen={isOpen} toggle={toggle} onSelect={setSel} />
            : <CronogramaTable data={data} grupos={grupos} isOpen={isOpen} toggle={toggle} modo={modo} setModo={setModo} mesesProximos={mesesProximos} onSelect={setSel} />}

          <p className="text-2xs text-stone-400">
            {stats.items} insumos · {data.meses.length} meses · agrupados por tipo y categoría
          </p>
        </>
      )}

      {sel && <DetailPanel ins={sel} onClose={() => setSel(null)} icc={data?.icc ?? null} />}
    </div>
  );
}

// ─── Vista Totales ──────────────────────────────────────────────────────────
function TotalesTable({ grupos, isOpen, toggle, onSelect }: {
  grupos: { tipo: string; cats: { categoria: string; items: InsumoView[]; monto: number; count: number }[]; monto: number; count: number }[];
  isOpen: (k: string) => boolean; toggle: (k: string) => void; onSelect: (i: InsumoView) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-stone-50 border-b border-stone-200 text-2xs uppercase tracking-wider text-stone-500">
            <th className="text-left px-4 py-2.5 font-medium">Descripción</th>
            <th className="text-center px-3 py-2.5 font-medium w-16">Tipo</th>
            <th className="text-right px-4 py-2.5 font-medium w-32">Cantidad</th>
            <th className="text-right px-4 py-2.5 font-medium w-28">Costo</th>
            <th className="text-center px-3 py-2.5 font-medium w-24">Estado</th>
            <th className="text-left px-4 py-2.5 font-medium w-36">Período</th>
          </tr>
        </thead>
        <tbody>
          {grupos.map((g) => {
            const meta = TIPO_META[g.tipo];
            const tipoOpen = isOpen(g.tipo);
            return (
              <FragmentTipo key={g.tipo}>
                <tr className="bg-stone-50/80 border-b border-stone-200 cursor-pointer hover:bg-stone-100/70" onClick={() => toggle(g.tipo)}>
                  <td className="px-4 py-2.5" colSpan={3}>
                    <div className="flex items-center gap-2 font-bold text-stone-800">
                      {tipoOpen ? <ChevronDown className="h-4 w-4 text-stone-400" /> : <ChevronRight className="h-4 w-4 text-stone-400" />}
                      <span className={cn("h-2 w-2 rounded-full", meta?.dot)} />
                      {meta?.label ?? g.tipo}
                      <span className="text-2xs font-medium text-stone-400 bg-stone-200/70 rounded-full px-1.5">{g.count}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-stone-900 tabular-nums">{fmtMoney(g.monto, { compact: true })}</td>
                  <td colSpan={2} />
                </tr>
                {tipoOpen && g.cats.map((c) => {
                  const catKey = `${g.tipo}::${c.categoria}`;
                  const catOpen = isOpen(catKey);
                  return (
                    <FragmentTipo key={catKey}>
                      <tr className="border-b border-stone-100 cursor-pointer hover:bg-stone-50" onClick={() => toggle(catKey)}>
                        <td className="px-4 py-2" colSpan={3}>
                          <div className="flex items-center gap-2 pl-6 text-stone-600 font-medium">
                            {catOpen ? <ChevronDown className="h-3.5 w-3.5 text-stone-400" /> : <ChevronRight className="h-3.5 w-3.5 text-stone-400" />}
                            {c.categoria}
                            <span className="text-2xs font-medium text-stone-400 bg-stone-100 rounded-full px-1.5">{c.count}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-stone-600 tabular-nums">{fmtMoney(c.monto, { compact: true })}</td>
                        <td colSpan={2} />
                      </tr>
                      {catOpen && c.items.map((i) => (
                        <tr key={i.codigo} className="border-b border-stone-50 hover:bg-brand-50/40 cursor-pointer" onClick={() => onSelect(i)}>
                          <td className="px-4 py-2">
                            <span className="text-xs text-stone-800 pl-12 block truncate max-w-[420px]" title={`${i.codigo} · ${i.descripcion}`}>{i.descripcion}</span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={cn("text-2xs px-1.5 py-0.5 rounded font-medium", TIPO_META[i.tipo]?.badge)}>{TIPO_META[i.tipo]?.short}</span>
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-xs font-semibold text-stone-900 whitespace-nowrap">
                            {fmtCant(i.totalCantidad)} <span className="text-2xs font-normal text-stone-400">{i.unidad}</span>
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-xs font-semibold text-stone-700">{fmtMoney(i.totalMonto, { compact: true })}</td>
                          <td className="px-3 py-2 text-center">
                            {i._estado && <span className={cn("text-2xs px-1.5 py-0.5 rounded-full border font-medium", ESTADO_BADGE[i._estado])}>{i._estado}</span>}
                          </td>
                          <td className="px-4 py-2 text-2xs text-stone-500 whitespace-nowrap">
                            {i._min && (i._min === i._max ? fmtMesCorto(i._min) : `${fmtMesCorto(i._min)} – ${fmtMesCorto(i._max!)}`)}
                          </td>
                        </tr>
                      ))}
                    </FragmentTipo>
                  );
                })}
              </FragmentTipo>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

// ─── Vista Cronograma (matriz) ────────────────────────────────────────────────
function CronogramaTable({ data, grupos, isOpen, toggle, modo, setModo, mesesProximos, onSelect }: {
  data: ProyeccionData;
  grupos: { tipo: string; cats: { categoria: string; items: InsumoView[]; monto: number; count: number; porMes: Record<string, Celda> }[]; monto: number; count: number; porMes: Record<string, Celda> }[];
  isOpen: (k: string) => boolean; toggle: (k: string) => void;
  modo: "cantidad" | "monto"; setModo: (m: "cantidad" | "monto") => void;
  mesesProximos: Set<string>; onSelect: (i: InsumoView) => void;
}) {
  const cell = (c: Celda | undefined) => {
    const v = c ? (modo === "cantidad" ? c.cantidad : c.monto) : 0;
    return v ? (modo === "cantidad" ? fmtCant(v) : fmtMoney(v, { compact: true })) : "·";
  };
  return (
    <Card className="overflow-hidden">
      <div className="flex justify-end px-4 py-2 border-b border-stone-100">
        <div className="flex rounded-lg border border-stone-200 overflow-hidden">
          {(["cantidad", "monto"] as const).map((m) => (
            <button key={m} onClick={() => setModo(m)}
              className={cn("px-3 py-1.5 text-xs font-medium transition-colors", modo === m ? "bg-brand-700 text-white" : "bg-white text-stone-600 hover:bg-stone-50")}>
              {m === "cantidad" ? "Cantidad" : "Costo $"}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200">
              <th className="text-left px-4 py-2.5 font-medium text-stone-500 text-2xs uppercase tracking-wider sticky left-0 bg-stone-50 z-10 min-w-[300px]">Insumo</th>
              {data.meses.map((m) => (
                <th key={m.mes} className={cn("text-right px-3 py-2.5 font-medium text-2xs uppercase tracking-wider whitespace-nowrap min-w-[78px]",
                  mesesProximos.has(m.mes) ? "bg-brand-50 text-brand-700" : "text-stone-500")}>{m.label}</th>
              ))}
              <th className="text-right px-4 py-2.5 font-medium text-stone-500 text-2xs uppercase tracking-wider sticky right-0 bg-stone-50 min-w-[96px]">Total</th>
            </tr>
          </thead>
          <tbody>
            {grupos.map((g) => {
              const meta = TIPO_META[g.tipo];
              const tipoOpen = isOpen(g.tipo);
              return (
                <FragmentTipo key={g.tipo}>
                  <tr className="bg-stone-50/80 border-b border-stone-200 cursor-pointer hover:bg-stone-100/70" onClick={() => toggle(g.tipo)}>
                    <td className="px-4 py-2 sticky left-0 bg-stone-50 z-10">
                      <div className="flex items-center gap-2 font-bold text-stone-800">
                        {tipoOpen ? <ChevronDown className="h-4 w-4 text-stone-400" /> : <ChevronRight className="h-4 w-4 text-stone-400" />}
                        <span className={cn("h-2 w-2 rounded-full", meta?.dot)} />
                        {meta?.label ?? g.tipo}
                        <span className="text-2xs font-medium text-stone-400 bg-stone-200/70 rounded-full px-1.5">{g.count}</span>
                      </div>
                    </td>
                    {data.meses.map((m) => (
                      <td key={m.mes} className="px-3 py-2 text-right tabular-nums text-2xs text-stone-400">{g.porMes[m.mes] ? fmtMoney(g.porMes[m.mes].monto, { compact: true }) : ""}</td>
                    ))}
                    <td className="px-4 py-2 text-right font-bold text-stone-900 tabular-nums text-xs sticky right-0 bg-stone-50">{fmtMoney(g.monto, { compact: true })}</td>
                  </tr>
                  {tipoOpen && g.cats.map((c) => {
                    const catKey = `${g.tipo}::${c.categoria}`;
                    const catOpen = isOpen(catKey);
                    return (
                      <FragmentTipo key={catKey}>
                        <tr className="border-b border-stone-100 cursor-pointer hover:bg-stone-50" onClick={() => toggle(catKey)}>
                          <td className="px-4 py-2 sticky left-0 bg-white z-10">
                            <div className="flex items-center gap-2 pl-6 text-stone-600 font-medium">
                              {catOpen ? <ChevronDown className="h-3.5 w-3.5 text-stone-400" /> : <ChevronRight className="h-3.5 w-3.5 text-stone-400" />}
                              {c.categoria}
                              <span className="text-2xs font-medium text-stone-400 bg-stone-100 rounded-full px-1.5">{c.count}</span>
                            </div>
                          </td>
                          {data.meses.map((m) => (
                            <td key={m.mes} className="px-3 py-2 text-right tabular-nums text-2xs text-stone-300">{c.porMes[m.mes] ? fmtMoney(c.porMes[m.mes].monto, { compact: true }) : ""}</td>
                          ))}
                          <td className="px-4 py-2 text-right font-semibold text-stone-600 tabular-nums text-xs sticky right-0 bg-white">{fmtMoney(c.monto, { compact: true })}</td>
                        </tr>
                        {catOpen && c.items.map((i) => (
                          <tr key={i.codigo} className="border-b border-stone-50 hover:bg-brand-50/40 cursor-pointer" onClick={() => onSelect(i)}>
                            <td className="px-4 py-2 sticky left-0 bg-white">
                              <div className="flex items-center gap-2 min-w-0 pl-12">
                                <span className={cn("text-2xs px-1.5 py-0.5 rounded font-medium shrink-0", TIPO_META[i.tipo]?.badge)}>{i.unidad}</span>
                                <span className="text-xs text-stone-800 truncate max-w-[220px]" title={`${i.codigo} · ${i.descripcion}`}>{i.descripcion}</span>
                              </div>
                            </td>
                            {data.meses.map((m) => {
                              const c2 = i.porMes[m.mes];
                              return (
                                <td key={m.mes} className={cn("px-3 py-2 text-right tabular-nums text-xs",
                                  mesesProximos.has(m.mes) && "bg-brand-50/40", c2 ? "text-stone-800" : "text-stone-300")}>{cell(c2)}</td>
                              );
                            })}
                            <td className="px-4 py-2 text-right font-bold tabular-nums text-xs sticky right-0 bg-white">
                              {modo === "cantidad" ? fmtCant(i.totalCantidad) : fmtMoney(i.totalMonto, { compact: true })}
                            </td>
                          </tr>
                        ))}
                      </FragmentTipo>
                    );
                  })}
                </FragmentTipo>
              );
            })}
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
    </Card>
  );
}

// ─── Panel de detalle del insumo ──────────────────────────────────────────────
function DetailPanel({ ins, onClose, icc }: { ins: InsumoView; onClose: () => void; icc: IccData | null }) {
  const meta = TIPO_META[ins.tipo];
  const rubros = Object.entries(ins.porRubro).sort(([, a], [, b]) => b.monto - a.monto);
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-stone-900/20 backdrop-blur-sm animate-fade-in" />
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl overflow-y-auto animate-slide-in-right" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn("text-2xs px-2 py-0.5 rounded font-semibold", meta?.badge)}>{meta?.label ?? ins.tipo}</span>
              <span className="text-sm text-stone-500">{ins.categoria ?? "Sin categoría"}</span>
            </div>
            <button onClick={onClose} className="rounded-lg border border-stone-200 p-1.5 text-stone-500 hover:bg-stone-50"><X className="h-4 w-4" /></button>
          </div>

          <div>
            <h2 className="text-xl font-black text-stone-900 leading-tight">{ins.descripcion}</h2>
            {ins._estado && <span className={cn("inline-block mt-2 text-2xs px-2 py-0.5 rounded-full border font-medium", ESTADO_BADGE[ins._estado])}>{ins._estado}</span>}
          </div>

          <div className="grid grid-cols-2 gap-px bg-stone-200 rounded-xl overflow-hidden border border-stone-200">
            <Metric label="Cantidad total" value={`${fmtCant(ins.totalCantidad)} ${ins.unidad}`} />
            <Metric label="Precio unitario" value={`${fmtMoney(ins.precioUnitario, { compact: true })}/${ins.unidad}`} />
            <Metric label="Costo total" value={fmtMoney(ins.totalMonto, { compact: true })} accent />
            <Metric label="Período global" value={ins._min ? (ins._min === ins._max ? fmtMesCorto(ins._min) : `${fmtMesCorto(ins._min)} – ${fmtMesCorto(ins._max!)}`) : "—"} />
          </div>

          <div>
            <h3 className="text-2xs uppercase tracking-wider text-stone-400 font-semibold mb-2">Rubros que lo requieren</h3>
            <div className="divide-y divide-stone-100">
              {rubros.map(([rubro, c]) => (
                <div key={rubro} className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-stone-700 truncate pr-3" title={rubro}>{rubro}</span>
                  <div className="flex items-center gap-3 shrink-0 tabular-nums">
                    <span className="text-2xs text-stone-400">{fmtCant(c.cantidad)} {ins.unidad}</span>
                    <span className="text-sm font-semibold text-stone-800">{fmtMoney(c.monto, { compact: true })}</span>
                  </div>
                </div>
              ))}
              {rubros.length === 0 && <p className="text-sm text-stone-400 py-2">Sin desglose por rubro.</p>}
            </div>
          </div>

          <IccPriceBlock precioBase={ins.precioUnitario} montoBase={ins.totalMonto} unidad={ins.unidad} icc={icc} />
        </div>
      </div>
    </div>
  );
}

function IccPriceBlock({
  precioBase, montoBase, unidad, icc, coef,
}: {
  precioBase: number;
  montoBase: number;
  unidad?: string;
  icc: IccData | null;
  coef?: number | null;
}) {
  const coefICC = coef ?? null;
  const hasCoef = coefICC !== null && coefICC > 0;
  const precioActualizado = hasCoef ? precioBase * coefICC : null;
  const montoActualizado = hasCoef ? montoBase * coefICC : null;

  return (
    <div className="border-t border-stone-100 pt-3 space-y-2">
      {hasCoef ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-2xs uppercase tracking-wider text-amber-700 font-semibold">Precio actualizado (ICC)</p>
            <span className="text-2xs font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
              ×{coefICC.toFixed(3)}
            </span>
          </div>
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-xl font-black text-stone-900">
                {fmtMoney(precioActualizado!, { compact: true })}{unidad ? `/${unidad}` : ""}
              </p>
              <p className="text-[10px] text-stone-400 mt-0.5">
                Costo total actualizado: {fmtMoney(montoActualizado!, { compact: true })}
              </p>
            </div>
            <div className="text-right pb-0.5">
              <p className="text-2xs text-stone-400">Base del ppto</p>
              <p className="text-xs text-stone-500 font-medium line-through">
                {fmtMoney(precioBase, { compact: true })}{unidad ? `/${unidad}` : ""}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-2xs text-stone-400">
          {icc
            ? `ICC ${icc.mesLabel}${icc.variacionMensual !== null ? `: +${icc.variacionMensual.toFixed(1)}% mensual` : ""}. Sin valor absoluto para calcular coeficiente.`
            : "Cargando índice ICC…"}
        </p>
      )}
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-white p-4">
      <p className="text-2xs uppercase tracking-wider text-stone-400 font-semibold">{label}</p>
      <p className={cn("text-lg font-black mt-0.5", accent ? "text-brand-700" : "text-stone-900")}>{value}</p>
    </div>
  );
}

// ─── Filtro multi-rubro ───────────────────────────────────────────────────────
function RubroFilter({ rubros, selected, onChange }: { rubros: string[]; selected: string[]; onChange: (r: string[]) => void }) {
  const sel = new Set(selected);
  const toggle = (r: string) => {
    const n = new Set(sel); n.has(r) ? n.delete(r) : n.add(r);
    onChange([...n]);
  };
  const label = selected.length === 0 ? "Todos los rubros" : `${selected.length} rubro${selected.length > 1 ? "s" : ""}`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={cn("inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border",
          selected.length ? "bg-brand-50 text-brand-700 border-brand-200" : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50")}>
          <ListFilter className="h-3.5 w-3.5" /> {label}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto w-72">
        {selected.length > 0 && (
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onChange([]); }} className="text-brand-700 font-medium">
            Limpiar selección
          </DropdownMenuItem>
        )}
        {rubros.map((r) => (
          <DropdownMenuItem key={r} onSelect={(e) => { e.preventDefault(); toggle(r); }} className="gap-2">
            <span className={cn("flex h-4 w-4 items-center justify-center rounded border shrink-0", sel.has(r) ? "bg-brand-600 border-brand-600 text-white" : "border-stone-300")}>
              {sel.has(r) && <Check className="h-3 w-3" />}
            </span>
            <span className="truncate">{r}</span>
          </DropdownMenuItem>
        ))}
        {rubros.length === 0 && <div className="px-2 py-3 text-xs text-stone-400">Sin rubros</div>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Helpers de presentación ──────────────────────────────────────────────────
function FragmentTipo({ children }: { children: React.ReactNode }) { return <>{children}</>; }

function StatChip({ children, tone }: { children: React.ReactNode; tone?: "warn" }) {
  return (
    <span className={cn("inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border",
      tone === "warn" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-stone-50 text-stone-600 border-stone-200")}>
      {children}
    </span>
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

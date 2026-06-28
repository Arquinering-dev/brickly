import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Plus, ArrowLeft, FileSpreadsheet, Trash2, Calculator } from "lucide-react";
import { apiFetch } from "../lib/api";
import { fmtMoney, fmtPct, fmtDate } from "../lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input, Label } from "./ui/input";
import { EmptyState } from "./ui/empty";
import { Skeleton } from "./ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "./ui/dialog";

interface CertResumen {
  id: string;
  certId: string;
  fecha: string;
  mes: number | null;
  anio: number | null;
  bruto: number;         // base bruta = Σ avance × PV
  pctDesacopio: number;  // fracción 0..1
  desacopio: number;     // monto descontado
  subtotal: number;      // bruto − desacopio = lo que se envía al cliente
  estado: string;
  nota: string | null;
}

type BadgeVariant = "default" | "brand" | "accent" | "success" | "warning" | "info" | "danger" | "outline";

const ESTADO_META: Record<string, { label: string; variant: BadgeVariant }> = {
  borrador:   { label: "Borrador", variant: "default" },
  enviada:    { label: "Enviada al cliente", variant: "warning" },
  conformada: { label: "Conformada", variant: "success" },
  valorizada: { label: "Valorizada", variant: "info" },
  facturada:  { label: "Facturada", variant: "brand" },
  cobrada:    { label: "Cobrada", variant: "success" },
};
const estadoMeta = (e: string) => ESTADO_META[e] ?? { label: e, variant: "default" as BadgeVariant };

// Acciones de transición de estado disponibles desde cada estado (espeja el backend).
const TRANSICIONES: Record<string, Array<{ to: string; label: string; variant?: "default" | "outline" }>> = {
  borrador:   [{ to: "enviada", label: "Enviar al cliente" }],
  enviada:    [{ to: "conformada", label: "Marcar como conformada" }, { to: "borrador", label: "Volver a borrador", variant: "outline" }],
  conformada: [{ to: "enviada", label: "Volver a enviada", variant: "outline" }],
};

interface ValParte { base: number; cac: number; baseConCac: number; iva: number; total: number }
interface Valorizacion {
  ratioCac: number;
  facturable: ValParte;
  noFacturable: ValParte;
  totalCac: number;
  total: number;
}
interface ValInputs { pctFacturable: number; pctIva: number; indiceCacBase: number; indiceCacFecha: number }

// Espeja computarValorizacion del backend para recalcular en vivo mientras se editan los inputs.
function calcValorizacion(subtotal: number, i: ValInputs): Valorizacion {
  const ratioCac = i.indiceCacBase > 0 ? i.indiceCacFecha / i.indiceCacBase : 1;
  const pctF = Math.min(1, Math.max(0, i.pctFacturable));
  const pctIva = Math.min(1, Math.max(0, i.pctIva));
  const parte = (base: number, conIva: boolean): ValParte => {
    const cac = base * (ratioCac - 1);
    const baseConCac = base + cac;
    const iva = conIva ? baseConCac * pctIva : 0;
    return { base, cac, baseConCac, iva, total: baseConCac + iva };
  };
  const facturable = parte(subtotal * pctF, true);
  const noFacturable = parte(subtotal * (1 - pctF), false);
  return { ratioCac, facturable, noFacturable, totalCac: facturable.cac + noFacturable.cac, total: facturable.total + noFacturable.total };
}

interface LineaPreview {
  lineaId: string;
  itemNumero: string | null;
  descripcion: string;
  unidad: string;
  rubro: string;
  cantidad: number;
  pvTotalTarea: number;
  pctAnterior: number;
  pctActual: number;
  pctTotal: number;
  baseCertificada: number;
}

interface CertDetalle extends CertResumen {
  pctFacturable: number | null;
  pctIva: number | null;
  indiceCacBase: number | null;
  indiceCacFecha: number | null;
  valorizacion: Valorizacion | null;
  lineas: Array<{
    lineaId: string | null;
    codTarea: string;
    descripcion: string;
    rubro: string;
    unidad: string;
    pctAnterior: number;
    pctActual: number;
    pctTotal: number;
    pvTotalTarea: number;
    baseCertificada: number;
  }>;
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const periodoLabel = (mes: number | null, anio: number | null) =>
  mes && anio ? `${MESES[mes - 1]} ${anio}` : "—";

type View = { tipo: "list" } | { tipo: "create" } | { tipo: "detail"; id: string };

export function CertificacionesTab({ obraId }: { obraId: string }) {
  const [view, setView] = useState<View>({ tipo: "list" });

  if (view.tipo === "create") {
    return <CrearCertificacion obraId={obraId} onBack={() => setView({ tipo: "list" })} />;
  }
  if (view.tipo === "detail") {
    return <DetalleCertificacion obraId={obraId} certId={view.id} onBack={() => setView({ tipo: "list" })} />;
  }
  return (
    <ListaCertificaciones
      obraId={obraId}
      onNueva={() => setView({ tipo: "create" })}
      onVer={(id) => setView({ tipo: "detail", id })}
    />
  );
}

// ─── Lista ──────────────────────────────────────────────────────────────────
function ListaCertificaciones({
  obraId, onNueva, onVer,
}: { obraId: string; onNueva: () => void; onVer: (id: string) => void }) {
  const [certs, setCerts] = useState<CertResumen[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<CertResumen | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    let alive = true;
    apiFetch(`/api/obras/${obraId}/certificaciones`)
      .then((r) => r.json())
      .then((d) => { if (alive) setCerts(d.certificaciones ?? []); })
      .catch(() => { if (alive) setError("No se pudieron cargar las certificaciones"); });
    return () => { alive = false; };
  }, [obraId]);

  useEffect(() => load(), [load]);

  const borrar = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const r = await apiFetch(`/api/obras/${obraId}/certificaciones/${toDelete.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json()).error ?? "Error");
      setToDelete(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al borrar");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Certificaciones de avance</h2>
          <p className="text-sm text-slate-500">Valorizadas a precio de venta para facturar al comitente.</p>
        </div>
        <Button onClick={onNueva}><Plus className="h-4 w-4 mr-1.5" /> Nueva certificación</Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {certs === null ? (
        <Skeleton className="h-40 w-full" />
      ) : certs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Sin certificaciones"
          description="Creá la primera certificación tomando el avance reportado del mes."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3 font-medium">Período</th>
                  <th className="px-4 py-3 font-medium">Emitida</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium text-right">Subtotal a certificar</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {certs.map((c) => {
                  const m = estadoMeta(c.estado);
                  return (
                  <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-medium">{periodoLabel(c.mes, c.anio)}</td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(c.fecha)}</td>
                    <td className="px-4 py-3"><Badge variant={m.variant}>{m.label}</Badge></td>
                    <td className="px-4 py-3 text-right font-semibold stat-number">{fmtMoney(c.subtotal)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" onClick={() => onVer(c.id)}>Ver</Button>
                      <Button variant="ghost" size="icon-sm" className="text-slate-400 hover:text-red-600" title="Borrar" onClick={() => setToDelete(c)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" /> Borrar certificación
            </DialogTitle>
            <DialogDescription>
              Se eliminará la certificación de <strong>{toDelete && periodoLabel(toDelete.mes, toDelete.anio)}</strong> y
              sus líneas. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setToDelete(null)} disabled={deleting}>Cancelar</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={borrar} disabled={deleting}>
              {deleting ? "Borrando…" : "Sí, borrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Crear ──────────────────────────────────────────────────────────────────
function defaultPeriodo(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function CrearCertificacion({ obraId, onBack }: { obraId: string; onBack: () => void }) {
  const [periodo, setPeriodo] = useState(defaultPeriodo());
  const [lineas, setLineas] = useState<LineaPreview[] | null>(null);
  // override de pctActual editado por el usuario, como fracción 0..1
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  // % desacopio como porcentaje (0..100) para el input; se envía como fracción.
  const [pctDesacInput, setPctDesacInput] = useState(0);

  const [anioStr, mesStr] = periodo.split("-");
  const mes = Number(mesStr);
  const anio = Number(anioStr);

  const cargarPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    setEdits({});
    try {
      const r = await apiFetch(`/api/obras/${obraId}/certificaciones/preview?mes=${mes}&anio=${anio}`);
      if (!r.ok) throw new Error((await r.json()).error ?? "Error");
      const d = await r.json();
      setLineas(d.lineas ?? []);
      setPctDesacInput(Math.round((d.pctDesacopioSugerido ?? 0) * 10000) / 100);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al calcular");
      setLineas(null);
    } finally {
      setLoading(false);
    }
  }, [obraId, mes, anio]);

  useEffect(() => { cargarPreview(); }, [cargarPreview]);

  const pctActualDe = useCallback(
    (l: LineaPreview) => (l.lineaId in edits ? edits[l.lineaId] : l.pctActual),
    [edits],
  );

  const { grupos, total } = useMemo(() => {
    const map = new Map<string, LineaPreview[]>();
    let total = 0;
    for (const l of lineas ?? []) {
      const pa = pctActualDe(l);
      total += l.pvTotalTarea * pa;
      const arr = map.get(l.rubro) ?? [];
      arr.push(l);
      map.set(l.rubro, arr);
    }
    return { grupos: [...map.entries()], total };
  }, [lineas, pctActualDe]);

  const pctDesacFrac = Math.min(1, Math.max(0, pctDesacInput / 100));
  const desacopio = total * pctDesacFrac;
  const subtotal = total - desacopio;

  const emitir = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        mes, anio, nota: nota || undefined, pctDesacopio: pctDesacFrac,
        lineas: (lineas ?? []).map((l) => ({ lineaId: l.lineaId, pctActual: pctActualDe(l) })),
      };
      const r = await apiFetch(`/api/obras/${obraId}/certificaciones`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Error al emitir");
      onBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al emitir");
    } finally {
      setSaving(false);
    }
  };

  const hayLineas = (lineas?.length ?? 0) > 0;

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Volver
      </button>

      <Card>
        <CardHeader>
          <CardTitle>Nueva certificación de avance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-48">
              <Label>Mes a certificar</Label>
              <Input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label>Nota (opcional)</Label>
              <Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Observación de la certificación" />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : !hayLineas ? (
            <EmptyState
              icon={FileSpreadsheet}
              title="Sin avance en el período"
              description="No hay avance reportado en este mes para certificar. Probá con otro mes."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400">
                      <th className="px-3 py-2 font-medium">Tarea</th>
                      <th className="px-3 py-2 font-medium text-right">% anterior</th>
                      <th className="px-3 py-2 font-medium text-right">% este mes</th>
                      <th className="px-3 py-2 font-medium text-right">% total</th>
                      <th className="px-3 py-2 font-medium text-right">PV tarea</th>
                      <th className="px-3 py-2 font-medium text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grupos.map(([rubro, ls]) => (
                      <RubroRows
                        key={rubro}
                        rubro={rubro}
                        lineas={ls}
                        pctActualDe={pctActualDe}
                        onEdit={(lineaId, frac) => setEdits((p) => ({ ...p, [lineaId]: frac }))}
                      />
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200">
                      <td className="px-3 py-2 text-slate-500" colSpan={5}>Total bruto</td>
                      <td className="px-3 py-2 text-right stat-number">{fmtMoney(total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Desacopio → subtotal a enviar al cliente (sin CAC ni IVA) */}
              <div className="ml-auto w-full max-w-sm rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Total bruto</span>
                  <span className="stat-number">{fmtMoney(total)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Desacopio</span>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number" min={0} max={100} step="0.01"
                      className="h-8 w-20 text-right"
                      value={pctDesacInput}
                      onChange={(e) => setPctDesacInput(Math.min(100, Math.max(0, Number(e.target.value))))}
                    />
                    <span className="text-slate-400">%</span>
                    <span className="stat-number w-28 text-right">− {fmtMoney(desacopio)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-2 font-bold">
                  <span>Subtotal a certificar</span>
                  <span className="stat-number text-base">{fmtMoney(subtotal)}</span>
                </div>
                <p className="text-2xs text-slate-400 pt-1">Lo que se envía al cliente para validar. CAC e IVA se aplican en la certificación formal, luego de la conformidad.</p>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onBack} disabled={saving}>Cancelar</Button>
                <Button onClick={emitir} disabled={saving}>{saving ? "Guardando…" : "Crear certificación (borrador)"}</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RubroRows({
  rubro, lineas, pctActualDe, onEdit,
}: {
  rubro: string;
  lineas: LineaPreview[];
  pctActualDe: (l: LineaPreview) => number;
  onEdit: (lineaId: string, frac: number) => void;
}) {
  return (
    <>
      <tr className="bg-slate-50/70">
        <td colSpan={6} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{rubro}</td>
      </tr>
      {lineas.map((l) => {
        const pa = pctActualDe(l);
        const pctTotal = Math.min(1, l.pctAnterior + pa);
        return (
          <tr key={l.lineaId} className="border-b border-slate-50 last:border-0">
            <td className="px-3 py-2">
              <div className="font-medium">{l.descripcion}</div>
              {l.itemNumero && <div className="text-xs text-slate-400 font-mono">{l.itemNumero}</div>}
            </td>
            <td className="px-3 py-2 text-right text-slate-500">{fmtPct(l.pctAnterior)}</td>
            <td className="px-3 py-2 text-right">
              <div className="inline-flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  className="h-8 w-20 text-right"
                  value={Number((pa * 100).toFixed(2))}
                  onChange={(e) => {
                    const v = Math.min(100, Math.max(0, Number(e.target.value)));
                    onEdit(l.lineaId, v / 100);
                  }}
                />
                <span className="text-slate-400">%</span>
              </div>
            </td>
            <td className="px-3 py-2 text-right text-slate-500">{fmtPct(pctTotal)}</td>
            <td className="px-3 py-2 text-right text-slate-500 stat-number">{fmtMoney(l.pvTotalTarea)}</td>
            <td className="px-3 py-2 text-right font-semibold stat-number">{fmtMoney(l.pvTotalTarea * pa)}</td>
          </tr>
        );
      })}
    </>
  );
}

// ─── Detalle ──────────────────────────────────────────────────────────────────
function DetalleCertificacion({
  obraId, certId, onBack,
}: { obraId: string; certId: string; onBack: () => void }) {
  const [cert, setCert] = useState<CertDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transicionando, setTransicionando] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let alive = true;
    apiFetch(`/api/obras/${obraId}/certificaciones/${certId}`)
      .then((r) => r.json())
      .then((d) => { if (alive) setCert(d); })
      .catch(() => { if (alive) setError("No se pudo cargar la certificación"); });
    return () => { alive = false; };
  }, [obraId, certId]);

  const borrar = async () => {
    setDeleting(true);
    try {
      const r = await apiFetch(`/api/obras/${obraId}/certificaciones/${certId}`, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json()).error ?? "Error");
      onBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al borrar");
      setDeleting(false);
    }
  };

  const cambiarEstado = async (estado: string) => {
    setTransicionando(true);
    setError(null);
    try {
      const r = await apiFetch(`/api/obras/${obraId}/certificaciones/${certId}`, {
        method: "PATCH",
        body: JSON.stringify({ estado }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Error");
      const cab = await r.json(); // PATCH devuelve solo la cabecera → merge para conservar líneas
      setCert((prev) => (prev ? { ...prev, ...cab } : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cambiar estado");
    } finally {
      setTransicionando(false);
    }
  };

  if (error && !cert) return <p className="text-sm text-red-600">{error}</p>;
  if (!cert) return <Skeleton className="h-64 w-full" />;

  const m = estadoMeta(cert.estado);
  const acciones = TRANSICIONES[cert.estado] ?? [];

  const grupos = new Map<string, CertDetalle["lineas"]>();
  for (const l of cert.lineas) {
    const arr = grupos.get(l.rubro) ?? [];
    arr.push(l);
    grupos.set(l.rubro, arr);
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Volver
      </button>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle>Certificación — {periodoLabel(cert.mes, cert.anio)}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={m.variant}>{m.label}</Badge>
              <Button variant="ghost" size="icon-sm" className="text-slate-400 hover:text-red-600" title="Borrar" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {cert.nota && <p className="text-sm text-slate-500">{cert.nota}</p>}
          {acciones.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {acciones.map((a) => (
                <Button
                  key={a.to}
                  size="sm"
                  variant={a.variant === "outline" ? "outline" : "default"}
                  disabled={transicionando}
                  onClick={() => cambiarEstado(a.to)}
                >
                  {a.label}
                </Button>
              ))}
            </div>
          )}
          {error && <p className="text-sm text-red-600 pt-1">{error}</p>}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400">
                  <th className="px-3 py-2 font-medium">Tarea</th>
                  <th className="px-3 py-2 font-medium text-right">% este mes</th>
                  <th className="px-3 py-2 font-medium text-right">% total</th>
                  <th className="px-3 py-2 font-medium text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {[...grupos.entries()].map(([rubro, ls]) => (
                  <Fragment key={rubro}>
                    <tr className="bg-slate-50/70">
                      <td colSpan={4} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{rubro}</td>
                    </tr>
                    {ls.map((l, i) => (
                      <tr key={(l.lineaId ?? l.codTarea) + i} className="border-b border-slate-50 last:border-0">
                        <td className="px-3 py-2 font-medium">{l.descripcion}</td>
                        <td className="px-3 py-2 text-right">{fmtPct(l.pctActual)}</td>
                        <td className="px-3 py-2 text-right text-slate-500">{fmtPct(l.pctTotal)}</td>
                        <td className="px-3 py-2 text-right font-semibold stat-number">{fmtMoney(l.baseCertificada)}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200">
                  <td className="px-3 py-2 text-slate-500" colSpan={3}>Total bruto</td>
                  <td className="px-3 py-2 text-right stat-number">{fmtMoney(cert.bruto)}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-slate-500" colSpan={3}>Desacopio ({fmtPct(cert.pctDesacopio)})</td>
                  <td className="px-3 py-2 text-right stat-number">− {fmtMoney(cert.desacopio)}</td>
                </tr>
                <tr className="border-t-2 border-slate-200 font-bold">
                  <td className="px-3 py-3" colSpan={3}>Subtotal a certificar</td>
                  <td className="px-3 py-3 text-right stat-number text-base">{fmtMoney(cert.subtotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {["conformada", "valorizada", "facturada", "cobrada"].includes(cert.estado) && (
        <ValorizacionPanel
          obraId={obraId}
          certId={certId}
          estado={cert.estado}
          onValorizada={(cab) => setCert((prev) => (prev ? { ...prev, ...cab } : prev))}
        />
      )}

      <Dialog open={confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" /> Borrar certificación
            </DialogTitle>
            <DialogDescription>
              Se eliminará la certificación de <strong>{periodoLabel(cert.mes, cert.anio)}</strong> y sus líneas.
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleting}>Cancelar</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={borrar} disabled={deleting}>
              {deleting ? "Borrando…" : "Sí, borrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Panel de valorización formal (CAC + facturable/no facturable + IVA) ────────
function ValorizacionPanel({
  obraId, certId, estado, onValorizada,
}: {
  obraId: string;
  certId: string;
  estado: string;
  onValorizada: (cab: Partial<CertDetalle>) => void;
}) {
  const [subtotal, setSubtotal] = useState(0);
  const [inputs, setInputs] = useState<ValInputs | null>(null);
  const [cacDisponible, setCacDisponible] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);

  const editable = estado === "conformada" || estado === "valorizada";

  useEffect(() => {
    let alive = true;
    apiFetch(`/api/obras/${obraId}/certificaciones/${certId}/valorizacion`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setSubtotal(d.subtotal ?? 0);
        setInputs(d.inputs);
        setCacDisponible(d.indiceCacFechaDisponible ?? true);
      })
      .catch(() => { if (alive) setError("No se pudo cargar la valorización"); });
    return () => { alive = false; };
  }, [obraId, certId]);

  if (error) return <Card><CardContent className="py-4 text-sm text-red-600">{error}</CardContent></Card>;
  if (!inputs) return <Skeleton className="h-56 w-full" />;

  const val = calcValorizacion(subtotal, inputs);
  const set = (patch: Partial<ValInputs>) => setInputs((p) => ({ ...p!, ...patch }));

  const valorizar = async () => {
    setSaving(true);
    setError(null);
    setOk(false);
    try {
      const r = await apiFetch(`/api/obras/${obraId}/certificaciones/${certId}/valorizar`, {
        method: "POST",
        body: JSON.stringify(inputs),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Error");
      onValorizada(await r.json());
      setOk(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al valorizar");
    } finally {
      setSaving(false);
    }
  };

  const Row = ({ label, f, n, bold }: { label: string; f: number; n: number; bold?: boolean }) => (
    <tr className={bold ? "border-t-2 border-slate-200 font-bold" : "border-t border-slate-50"}>
      <td className="px-3 py-2 text-slate-600">{label}</td>
      <td className="px-3 py-2 text-right stat-number">{fmtMoney(f)}</td>
      <td className="px-3 py-2 text-right stat-number">{fmtMoney(n)}</td>
      <td className="px-3 py-2 text-right stat-number">{fmtMoney(f + n)}</td>
    </tr>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="h-4 w-4" /> Certificación formal (CAC · facturable/no facturable · IVA)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!cacDisponible && (
          <p className="text-xs text-amber-600">No hay índice CAC cargado para el mes de la certificación — completá el índice a la fecha a mano (ratio = índice fecha / índice base).</p>
        )}

        {/* Inputs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label>Índice CAC base</Label>
            <Input type="number" step="0.01" disabled={!editable} value={inputs.indiceCacBase}
              onChange={(e) => set({ indiceCacBase: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Índice CAC a la fecha</Label>
            <Input type="number" step="0.01" disabled={!editable} value={inputs.indiceCacFecha}
              onChange={(e) => set({ indiceCacFecha: Number(e.target.value) })} />
          </div>
          <div>
            <Label>% Facturable</Label>
            <Input type="number" min={0} max={100} step="0.01" disabled={!editable}
              value={Number((inputs.pctFacturable * 100).toFixed(2))}
              onChange={(e) => set({ pctFacturable: Math.min(100, Math.max(0, Number(e.target.value))) / 100 })} />
            <p className="text-2xs text-slate-400 mt-1">No facturable: {fmtPct(1 - inputs.pctFacturable)}</p>
          </div>
          <div>
            <Label>% IVA (s/ facturable)</Label>
            <Input type="number" min={0} max={100} step="0.01" disabled={!editable}
              value={Number((inputs.pctIva * 100).toFixed(2))}
              onChange={(e) => set({ pctIva: Math.min(100, Math.max(0, Number(e.target.value))) / 100 })} />
          </div>
        </div>

        <p className="text-xs text-slate-500">
          Subtotal conformado: <span className="stat-number font-medium">{fmtMoney(subtotal)}</span> ·
          Ratio CAC: <span className="stat-number font-medium">{val.ratioCac.toFixed(4)}</span>
        </p>

        {/* Desglose */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400">
                <th className="px-3 py-2 text-left font-medium"></th>
                <th className="px-3 py-2 text-right font-medium">Facturable</th>
                <th className="px-3 py-2 text-right font-medium">No facturable</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              <Row label="Base neta" f={val.facturable.base} n={val.noFacturable.base} />
              <Row label="Redeterminación CAC" f={val.facturable.cac} n={val.noFacturable.cac} />
              <Row label="Base + CAC" f={val.facturable.baseConCac} n={val.noFacturable.baseConCac} />
              <Row label="IVA" f={val.facturable.iva} n={val.noFacturable.iva} />
              <Row label="Total" f={val.facturable.total} n={val.noFacturable.total} bold />
            </tbody>
          </table>
        </div>

        {editable && (
          <div className="flex items-center justify-end gap-3">
            {ok && <span className="text-sm text-success-700">Valorización guardada ✓</span>}
            <Button onClick={valorizar} disabled={saving}>
              {saving ? "Guardando…" : estado === "valorizada" ? "Actualizar valorización" : "Confirmar valorización"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

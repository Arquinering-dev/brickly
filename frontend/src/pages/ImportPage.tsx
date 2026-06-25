import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle,
  XCircle, Loader2, Package, HardHat, Wrench, Building2,
  Layers, RefreshCw, ArrowRight, Plus,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { apiFetch } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { cn } from "../lib/cn";
import { NuevaObraDialog } from "../components/NuevaObraDialog";

/* ─── Tipos ─────────────────────────────────────────────────────────────────── */

interface ControlSummary {
  rubros: number; indicesCAC: number; tarifasUOCRA: number;
  movimientos: number; subcontratos: number; quincenas: number;
  gastosDirInd: number; contratos: number; certificaciones: number; lineasCert: number;
}

interface ResumenResult {
  obra: { nombre: string; codigo: string; estado: string };
  insumos: { total: number; porTipo: Record<string, number> };
  partidas: number;
  composiciones: number;
  presupuesto: {
    coefGGBB: number; cacValor: number; mesCac: string;
    lineas: number; costoDirectoTotal: number; precioVentaTotal: number;
  } | null;
  iccPuntos: number;
  cronogramaFilas: number;
  control: ControlSummary;
  obraId?: string;
  presupuestoHeaderId?: string;
  warnings: string[];
  errors: string[];
  dryRun: boolean;
  message?: string;
}

interface Obra {
  id: string;
  nombre: string;
  codigo: string;
}

type Stage = "idle" | "previewing" | "preview_ok" | "preview_error" | "importing" | "done" | "error";

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

const fmtMoney = (n: number) =>
  n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

function SummaryCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-lg p-3 border border-emerald-100 text-center">
      <p className="text-2xl font-bold text-stone-900 tabular-nums">{value.toLocaleString("es-AR")}</p>
      <p className="text-xs text-stone-500 mt-0.5">{label}</p>
    </div>
  );
}

function StatRow({ icon: Icon, label, value, color = "text-stone-700" }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: number; color?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-stone-100 last:border-0">
      <div className="flex items-center gap-2 text-sm text-stone-600">
        <Icon className={cn("h-4 w-4", color)} />
        {label}
      </div>
      <span className={cn("text-sm font-semibold tabular-nums", color)}>{value.toLocaleString("es-AR")}</span>
    </div>
  );
}

function Dropzone({ onFile, disabled, loading, file, loadingText }: {
  onFile: (f: File) => void; disabled: boolean; loading: boolean; file: File | null; loadingText: string;
}) {
  const onDrop = useCallback((accepted: File[]) => { if (accepted.length > 0) onFile(accepted[0]); }, [onFile]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] },
    maxFiles: 1,
    disabled,
  });
  return (
    <div
      {...getRootProps()}
      className={cn(
        "rounded-xl border-2 border-dashed transition-all cursor-pointer p-10 text-center",
        isDragActive ? "border-brand-500 bg-brand-50"
          : loading ? "border-stone-200 bg-stone-50 cursor-default opacity-60"
          : file ? "border-brand-300 bg-brand-50/40"
          : "border-stone-300 bg-white hover:border-brand-400 hover:bg-brand-50/30",
      )}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-3">
        {loading ? <Loader2 className="h-10 w-10 text-brand-500 animate-spin" />
          : file ? <FileSpreadsheet className="h-10 w-10 text-brand-500" />
          : <Upload className="h-10 w-10 text-stone-400" />}
        <div>
          {loading && <p className="text-sm font-medium text-stone-600">{loadingText}</p>}
          {!loading && !file && (
            <>
              <p className="text-sm font-medium text-stone-700">
                {isDragActive ? "Soltá el archivo acá" : "Arrastrá el Resumen de Obra o hacé click para seleccionar"}
              </p>
              <p className="text-xs text-stone-400 mt-1">Solo archivos .xlsx (formato v8)</p>
            </>
          )}
          {!loading && file && (
            <>
              <p className="text-sm font-medium text-stone-700">{file.name}</p>
              <p className="text-xs text-stone-400 mt-1">Soltá otro archivo para reemplazar</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Página ─────────────────────────────────────────────────────────────────── */

export default function ImportPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [obras, setObras] = useState<Obra[]>([]);
  const [obraId, setObraId] = useState<string>("");
  const [stage, setStage] = useState<Stage>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ResumenResult | null>(null);
  const [result, setResult] = useState<ResumenResult | null>(null);
  const [nuevaOpen, setNuevaOpen] = useState(false);

  const loadObras = useCallback((selectId?: string) => {
    apiFetch("/api/obras")
      .then((r) => r.json())
      .then((data: Obra[]) => {
        setObras(data);
        if (selectId) setObraId(selectId);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadObras();
    const preset = searchParams.get("obra");
    if (preset) setObraId(preset);
  }, [loadObras, searchParams]);

  const handleFile = useCallback((f: File) => {
    if (!obraId) { toast.error("Seleccioná la obra destino antes de subir el archivo"); return; }
    setFile(f);
    setResult(null);
    runPreview(f, obraId);
  }, [obraId]);

  async function runPreview(f: File, id: string) {
    setStage("previewing");
    try {
      const form = new FormData();
      form.append("file", f);
      form.append("obraId", id);
      const res = await apiFetch("/api/import/resumen?dry=1", { method: "POST", body: form });
      const data: ResumenResult = await res.json();
      setPreview(data);
      setStage(data.errors?.length > 0 ? "preview_error" : "preview_ok");
    } catch {
      setStage("error");
      toast.error("No se pudo conectar con el servidor");
    }
  }

  async function runImport() {
    if (!file || !obraId) return;
    setStage("importing");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("obraId", obraId);
      const res = await apiFetch("/api/import/resumen", { method: "POST", body: form });
      const data: ResumenResult = await res.json();
      if (!res.ok || data.errors?.length > 0) {
        setPreview(data);
        setStage("preview_error");
        toast.error("La importación falló — revisá los errores");
        return;
      }
      setResult(data);
      setStage("done");
      toast.success("Resumen de obra importado correctamente");
    } catch {
      setStage("error");
      toast.error("Error al importar");
    }
  }

  function reset() {
    setStage("idle"); setFile(null); setPreview(null); setResult(null);
  }

  const selectedObra = obras.find((o) => o.id === obraId);
  const loading = stage === "previewing" || stage === "importing";
  const data = preview;

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Importar Resumen de Obra</h1>
        <p className="text-sm text-stone-500 mt-1">
          Cargá el Excel de Resumen de Obra (v8) para completar una obra: presupuesto, insumos, ICC
          y el control financiero (movimientos, subcontratos, certificaciones).
        </p>
      </div>

      {/* Selector de obra destino */}
      {stage !== "done" && (
        <Card>
          <CardContent className="pt-5">
            <label className="block text-sm font-medium text-stone-700 mb-2">Obra destino</label>
            <div className="flex gap-2">
              <select
                value={obraId}
                onChange={(e) => { setObraId(e.target.value); reset(); }}
                className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
                disabled={loading}
              >
                <option value="">— Seleccioná una obra —</option>
                {obras.map((o) => (
                  <option key={o.id} value={o.id}>{o.codigo} — {o.nombre}</option>
                ))}
              </select>
              <Button variant="outline" onClick={() => setNuevaOpen(true)} disabled={loading} className="shrink-0">
                <Plus className="h-4 w-4" /> Nueva obra
              </Button>
            </div>
            <p className="text-xs text-stone-400 mt-1.5">
              El presupuesto, los KPIs y el ICC se cargan sobre esta obra. El nombre y código que pusiste se conservan.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Dropzone */}
      {obraId && stage !== "done" && (
        <Dropzone
          onFile={handleFile}
          disabled={loading || !obraId}
          loading={loading}
          file={file}
          loadingText={stage === "previewing" ? "Analizando archivo…" : "Importando a la obra…"}
        />
      )}

      {/* Preview */}
      {data && (stage === "preview_ok" || stage === "preview_error") && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Análisis del archivo</CardTitle>
              <Badge variant={data.errors?.length > 0 ? "danger" : "success"}>
                {data.errors?.length > 0 ? "Hay errores" : "Listo para importar"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Obra + presupuesto detectados */}
            {data.presupuesto && (
              <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="h-4 w-4 text-brand-600" />
                  <span className="text-sm font-semibold text-brand-900">
                    {data.obra.nombre} <span className="text-stone-400 font-mono">({data.obra.codigo})</span>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><p className="text-brand-700 font-medium">Mes base CAC</p><p className="text-stone-800">{data.presupuesto.mesCac || "—"}</p></div>
                  <div><p className="text-brand-700 font-medium">Costo directo</p><p className="text-stone-800 font-semibold">{fmtMoney(data.presupuesto.costoDirectoTotal)}</p></div>
                  <div><p className="text-brand-700 font-medium">Precio de venta</p><p className="text-stone-800 font-semibold">{fmtMoney(data.presupuesto.precioVentaTotal)}</p></div>
                  <div><p className="text-brand-700 font-medium">Ítems</p><p className="text-stone-800">{data.presupuesto.lineas} líneas · coef ×{data.presupuesto.coefGGBB}</p></div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {/* Insumos */}
              <div className="rounded-lg border border-stone-200 p-4">
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Insumos · Catálogo</p>
                <StatRow icon={Package} label="Materiales" value={data.insumos.porTipo.MATERIAL ?? 0} color="text-blue-500" />
                <StatRow icon={HardHat} label="Mano de Obra" value={data.insumos.porTipo.MANO_DE_OBRA ?? 0} color="text-amber-500" />
                <StatRow icon={Wrench} label="Equipos" value={data.insumos.porTipo.EQUIPO ?? 0} color="text-violet-500" />
                <StatRow icon={Building2} label="Subcontratos" value={data.insumos.porTipo.SUBCONTRATO ?? 0} color="text-teal-500" />
                <div className="flex items-center justify-between pt-2 mt-1">
                  <span className="text-xs font-bold text-stone-500 uppercase">Total insumos</span>
                  <span className="text-sm font-bold text-stone-900 tabular-nums">{data.insumos.total.toLocaleString("es-AR")}</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-stone-500"><Layers className="h-3.5 w-3.5 inline mr-1 text-brand-500" />Partidas APU</span>
                  <span className="text-sm font-semibold text-stone-900 tabular-nums">{data.partidas.toLocaleString("es-AR")}</span>
                </div>
              </div>

              {/* Control financiero */}
              <div className="rounded-lg border border-stone-200 p-4">
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Control financiero</p>
                <StatRow icon={Layers} label="Movimientos" value={data.control.movimientos} />
                <StatRow icon={Building2} label="Subcontratos" value={data.control.subcontratos} />
                <StatRow icon={HardHat} label="Quincenas MO" value={data.control.quincenas} />
                <StatRow icon={Package} label="Gastos dir/ind" value={data.control.gastosDirInd} />
                <StatRow icon={CheckCircle2} label="Certificaciones" value={data.control.certificaciones} />
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-stone-500">Contratos · Rubros · ICC</span>
                  <span className="text-sm font-semibold text-stone-900 tabular-nums">{data.control.contratos} · {data.control.rubros} · {data.iccPuntos}</span>
                </div>
              </div>
            </div>

            {data.errors?.length > 0 && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-red-700 mb-2">
                  <XCircle className="h-4 w-4" />
                  {data.errors.length} error{data.errors.length > 1 ? "es" : ""} — bloqueante{data.errors.length > 1 ? "s" : ""}
                </div>
                {data.errors.map((e, i) => <p key={i} className="text-xs text-red-600 font-mono leading-relaxed">{e}</p>)}
              </div>
            )}

            {data.warnings?.length > 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  {data.warnings.length} advertencia{data.warnings.length > 1 ? "s" : ""} — no bloquean
                </div>
                {data.warnings.slice(0, 8).map((w, i) => <p key={i} className="text-xs text-amber-700 font-mono leading-relaxed">{w}</p>)}
                {data.warnings.length > 8 && <p className="text-xs text-amber-600">…y {data.warnings.length - 8} más</p>}
              </div>
            )}

            {(!data.errors || data.errors.length === 0) && (
              <div className="flex justify-end pt-2">
                <Button onClick={runImport} className="gap-2" size="lg" disabled={loading}>
                  Importar a {selectedObra?.codigo}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Resultado */}
      {stage === "done" && result && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-4">
                <div>
                  <p className="font-semibold text-emerald-900 text-lg">Resumen de obra importado</p>
                  {selectedObra && <p className="text-sm text-emerald-700 mt-0.5">{selectedObra.codigo} — {selectedObra.nombre}</p>}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <SummaryCount label="Líneas ppto" value={result.presupuesto?.lineas ?? 0} />
                  <SummaryCount label="Insumos" value={result.insumos.total} />
                  <SummaryCount label="Movimientos" value={result.control.movimientos} />
                  <SummaryCount label="Subcontratos" value={result.control.subcontratos} />
                  <SummaryCount label="Certificaciones" value={result.control.certificaciones} />
                  <SummaryCount label="Quincenas MO" value={result.control.quincenas} />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button size="sm" onClick={() => navigate(`/obras/${obraId}/control`)} className="gap-2">
                    <ArrowRight className="h-4 w-4" /> Ver control financiero
                  </Button>
                  <Button variant="outline" size="sm" onClick={reset} className="gap-2">
                    <RefreshCw className="h-4 w-4" /> Importar otro
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {stage === "error" && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 flex items-center gap-3">
          <XCircle className="h-5 w-5 text-red-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700">Error al importar</p>
            <p className="text-xs text-red-600 mt-0.5">Revisá que el archivo sea un Resumen de Obra válido (formato v8).</p>
          </div>
          <Button variant="outline" size="sm" onClick={reset}>Reintentar</Button>
        </div>
      )}

      <NuevaObraDialog
        open={nuevaOpen}
        onOpenChange={setNuevaOpen}
        onCreated={(obra) => loadObras(obra.id)}
      />
    </div>
  );
}

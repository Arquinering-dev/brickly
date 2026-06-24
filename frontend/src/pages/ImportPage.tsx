import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useNavigate } from "react-router-dom";
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle,
  XCircle, Loader2, Package, HardHat, Wrench, Building2,
  Layers, RefreshCw, ArrowRight, Calculator, FileText,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { cn } from "../lib/cn";

/* ─── Tipos ─────────────────────────────────────────────────────────────────── */

interface PptoPreview {
  titulo: string;
  obraNombre: string;
  obraCodigo: string;
  mesCac: string;
  coefGGBB: number;
  lineas: number;
  costoDirectoTotal: number;
  precioVentaTotal: number;
}

interface ApuResult {
  insumos: { materiales: number; manoDeObra: number; equipos: number; subcontratos: number; total: number };
  partidas: number;
  composiciones: number;
  presupuesto: PptoPreview | null;
  obraId?: string;
  presupuestoHeaderId?: string;
  warnings: string[];
  errors: string[];
  dryRun: boolean;
  message?: string;
}

interface ResumenSummary {
  obraActualizada: boolean;
  rubros: number;
  indicesCAC: number;
  tarifasUOCRA: number;
  lineasPresupuesto: number;
  movimientos: number;
  subcontratos: number;
  quincenas: number;
  gastosDirInd: number;
  contratos: number;
  certificaciones: number;
  lineasCert: number;
  warnings: string[];
}

interface ResumenResult {
  summary: ResumenSummary;
  warnings: string[];
}

interface Obra {
  id: string;
  nombre: string;
  codigo: string;
}

type ApuStage = "idle" | "previewing" | "preview_ok" | "preview_error" | "importing" | "done" | "error";
type ResumenStage = "idle" | "uploading" | "done" | "error";
type Mode = "apu" | "resumen";

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

const fmtMoney = (n: number) =>
  n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

function StatRow({
  icon: Icon,
  label,
  value,
  color = "text-stone-700",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color?: string;
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

function SummaryCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-lg p-3 border border-emerald-100 text-center">
      <p className="text-2xl font-bold text-stone-900 tabular-nums">{value.toLocaleString("es-AR")}</p>
      <p className="text-xs text-stone-500 mt-0.5">{label}</p>
    </div>
  );
}

function Dropzone({
  onFile,
  disabled,
  stage,
  file,
  loadingText,
}: {
  onFile: (f: File) => void;
  disabled: boolean;
  stage: string;
  file: File | null;
  loadingText?: string;
}) {
  const onDrop = useCallback(
    (accepted: File[]) => { if (accepted.length > 0) onFile(accepted[0]); },
    [onFile],
  );
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] },
    maxFiles: 1,
    disabled,
  });
  const isLoading = stage === "previewing" || stage === "uploading" || stage === "importing";
  return (
    <div
      {...getRootProps()}
      className={cn(
        "rounded-xl border-2 border-dashed transition-all cursor-pointer p-10 text-center",
        isDragActive
          ? "border-brand-500 bg-brand-50"
          : isLoading
          ? "border-stone-200 bg-stone-50 cursor-default opacity-60"
          : file
          ? "border-brand-300 bg-brand-50/40"
          : "border-stone-300 bg-white hover:border-brand-400 hover:bg-brand-50/30",
      )}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-3">
        {isLoading ? (
          <Loader2 className="h-10 w-10 text-brand-500 animate-spin" />
        ) : file ? (
          <FileSpreadsheet className="h-10 w-10 text-brand-500" />
        ) : (
          <Upload className="h-10 w-10 text-stone-400" />
        )}
        <div>
          {isLoading && <p className="text-sm font-medium text-stone-600">{loadingText ?? "Procesando…"}</p>}
          {!isLoading && !file && (
            <>
              <p className="text-sm font-medium text-stone-700">
                {isDragActive ? "Soltá el archivo acá" : "Arrastrá el archivo o hacé click para seleccionar"}
              </p>
              <p className="text-xs text-stone-400 mt-1">Solo archivos .xlsx</p>
            </>
          )}
          {!isLoading && file && (
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

/* ─── Flujo APU Unificado ────────────────────────────────────────────────────── */

function ApuFlow() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<ApuStage>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ApuResult | null>(null);
  const [importResult, setImportResult] = useState<ApuResult | null>(null);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setPreview(null);
    runPreview(f);
  }, []);

  async function runPreview(f: File) {
    setStage("previewing");
    try {
      const form = new FormData();
      form.append("file", f);
      const res = await apiFetch("/api/import/apu?dry=1", { method: "POST", body: form });
      const data: ApuResult = await res.json();
      setPreview(data);
      setStage(data.errors.length > 0 ? "preview_error" : "preview_ok");
    } catch {
      setStage("error");
      toast.error("No se pudo conectar con el servidor");
    }
  }

  async function runImport() {
    if (!file) return;
    setStage("importing");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await apiFetch("/api/import/apu", { method: "POST", body: form });
      const data: ApuResult = await res.json();
      if (!res.ok || data.errors.length > 0) {
        setPreview(data);
        setStage("preview_error");
        toast.error("La importación falló — revisá los errores");
        return;
      }
      setImportResult(data);
      setStage("done");
      toast.success("Catálogo importado correctamente");
    } catch {
      setStage("error");
      toast.error("Error al importar");
    }
  }

  function reset() {
    setStage("idle");
    setFile(null);
    setPreview(null);
    setImportResult(null);
  }

  return (
    <div className="space-y-4">
      {/* Done */}
      {stage === "done" && importResult && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-4">
                <div>
                  <p className="font-semibold text-emerald-900 text-lg">Importación completada</p>
                  <p className="text-sm text-emerald-700 mt-0.5">Catálogo actualizado y presupuesto generado.</p>
                </div>
                {importResult.presupuesto && (
                  <div className="bg-white rounded-xl border border-emerald-100 p-4 space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm font-semibold text-stone-800">
                        Obra: {importResult.presupuesto.obraNombre}
                      </span>
                      <span className="text-xs text-stone-400 font-mono">({importResult.presupuesto.obraCodigo})</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-stone-500">Costo directo total</p>
                        <p className="font-bold text-stone-800 text-sm">{fmtMoney(importResult.presupuesto.costoDirectoTotal)}</p>
                      </div>
                      <div>
                        <p className="text-stone-500">Líneas de presupuesto</p>
                        <p className="font-bold text-stone-800 text-sm">{importResult.presupuesto.lineas}</p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Insumos", value: importResult.insumos.total },
                    { label: "Partidas APU", value: importResult.partidas },
                    { label: "Composiciones", value: importResult.composiciones },
                  ].map(({ label, value }) => (
                    <SummaryCount key={label} label={label} value={value} />
                  ))}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {importResult.presupuestoHeaderId && (
                    <Button size="sm" onClick={() => navigate(`/catalogo/presupuestos/${importResult.presupuestoHeaderId}`)} className="gap-2">
                      <Calculator className="h-4 w-4" />
                      Ver presupuesto
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={reset} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Importar otro
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dropzone */}
      {stage !== "done" && (
        <Dropzone
          onFile={handleFile}
          disabled={stage === "previewing" || stage === "importing"}
          stage={stage}
          file={file}
          loadingText={stage === "previewing" ? "Analizando archivo…" : "Importando al catálogo…"}
        />
      )}

      {/* Preview */}
      {preview && (stage === "preview_ok" || stage === "preview_error") && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Análisis del archivo</CardTitle>
              <Badge variant={preview.errors.length > 0 ? "danger" : "success"}>
                {preview.errors.length > 0 ? "Hay errores" : "Listo para importar"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-stone-200 p-4">
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Insumos</p>
                <StatRow icon={Package} label="Materiales" value={preview.insumos.materiales} color="text-blue-500" />
                <StatRow icon={HardHat} label="Mano de Obra" value={preview.insumos.manoDeObra} color="text-amber-500" />
                <StatRow icon={Wrench} label="Equipos" value={preview.insumos.equipos} color="text-violet-500" />
                <StatRow icon={Building2} label="Subcontratos" value={preview.insumos.subcontratos} color="text-teal-500" />
                <div className="flex items-center justify-between pt-2 mt-1">
                  <span className="text-xs font-bold text-stone-500 uppercase">Total</span>
                  <span className="text-sm font-bold text-stone-900 tabular-nums">{preview.insumos.total.toLocaleString("es-AR")}</span>
                </div>
              </div>
              <div className="rounded-lg border border-stone-200 p-4 space-y-2">
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Catálogo</p>
                <div className="flex items-center justify-between py-2 border-b border-stone-100">
                  <div className="flex items-center gap-2 text-sm text-stone-600">
                    <Layers className="h-4 w-4 text-brand-500" />
                    Partidas APU
                  </div>
                  <span className="text-sm font-semibold text-stone-900 tabular-nums">{preview.partidas.toLocaleString("es-AR")}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2 text-sm text-stone-600">
                    <Layers className="h-4 w-4 text-stone-400" />
                    Composiciones
                  </div>
                  <span className="text-sm font-semibold text-stone-900 tabular-nums">{preview.composiciones.toLocaleString("es-AR")}</span>
                </div>
                <div className="mt-4 pt-3 border-t border-stone-100">
                  <p className="text-xs text-stone-400 leading-relaxed">
                    La importación hace <strong>upsert</strong> por código — actualiza precios y composiciones sin duplicados.
                  </p>
                </div>
              </div>
            </div>

            {preview.errors.length > 0 && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-red-700 mb-2">
                  <XCircle className="h-4 w-4" />
                  {preview.errors.length} error{preview.errors.length > 1 ? "es" : ""} — bloqueante{preview.errors.length > 1 ? "s" : ""}
                </div>
                {preview.errors.map((e, i) => <p key={i} className="text-xs text-red-600 font-mono leading-relaxed">{e}</p>)}
              </div>
            )}

            {preview.warnings.length > 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  {preview.warnings.length} advertencia{preview.warnings.length > 1 ? "s" : ""} — no bloquean la importación
                </div>
                {preview.warnings.map((w, i) => <p key={i} className="text-xs text-amber-700 font-mono leading-relaxed">{w}</p>)}
              </div>
            )}

            {preview.presupuesto && (
              <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="h-4 w-4 text-brand-600" />
                  <span className="text-sm font-semibold text-brand-900">Obra y presupuesto detectados</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-brand-700 font-medium">Obra</p>
                    <p className="text-stone-800">{preview.presupuesto.obraNombre} <span className="text-stone-400 font-mono">({preview.presupuesto.obraCodigo})</span></p>
                  </div>
                  <div>
                    <p className="text-brand-700 font-medium">Mes base CAC</p>
                    <p className="text-stone-800">{preview.presupuesto.mesCac}</p>
                  </div>
                  <div>
                    <p className="text-brand-700 font-medium">Costo directo total</p>
                    <p className="text-stone-800 font-semibold">{fmtMoney(preview.presupuesto.costoDirectoTotal)}</p>
                  </div>
                  <div>
                    <p className="text-brand-700 font-medium">Ítems</p>
                    <p className="text-stone-800">{preview.presupuesto.lineas} líneas · coef GGBB ×{preview.presupuesto.coefGGBB}</p>
                  </div>
                </div>
              </div>
            )}

            {preview.errors.length === 0 && (
              <div className="flex justify-end pt-2">
                <Button onClick={runImport} className="gap-2" size="lg">
                  Importar catálogo + presupuesto
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ─── Flujo Resumen de Obra ──────────────────────────────────────────────────── */

function ResumenFlow() {
  const navigate = useNavigate();
  const [obras, setObras] = useState<Obra[]>([]);
  const [obraId, setObraId] = useState<string>("");
  const [stage, setStage] = useState<ResumenStage>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ResumenResult | null>(null);

  useEffect(() => {
    apiFetch("/api/obras")
      .then((r) => r.json())
      .then((data: Obra[]) => setObras(data))
      .catch(() => {});
  }, []);

  const handleFile = useCallback(
    (f: File) => {
      if (!obraId) {
        toast.error("Seleccioná una obra antes de subir el archivo");
        return;
      }
      setFile(f);
      runImport(f, obraId);
    },
    [obraId],
  );

  async function runImport(f: File, id: string) {
    setStage("uploading");
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", f);
      form.append("obraId", id);
      const res = await apiFetch("/api/import/resumen", { method: "POST", body: form });
      const data: ResumenResult = await res.json();
      if (!res.ok) {
        setStage("error");
        toast.error((data as { error?: string }).error ?? "Error al importar el resumen");
        return;
      }
      setResult(data);
      setStage("done");
      toast.success("Resumen de obra importado correctamente");
    } catch {
      setStage("error");
      toast.error("No se pudo conectar con el servidor");
    }
  }

  function reset() {
    setStage("idle");
    setFile(null);
    setResult(null);
  }

  const selectedObra = obras.find((o) => o.id === obraId);
  const allWarnings = result ? [...(result.warnings ?? []), ...(result.summary?.warnings ?? [])] : [];

  return (
    <div className="space-y-4">
      {/* Selector de obra */}
      <Card>
        <CardContent className="pt-5">
          <label className="block text-sm font-medium text-stone-700 mb-2">
            Obra destino
          </label>
          <select
            value={obraId}
            onChange={(e) => { setObraId(e.target.value); reset(); }}
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
            disabled={stage === "uploading"}
          >
            <option value="">— Seleccioná una obra —</option>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>
                {o.codigo} — {o.nombre}
              </option>
            ))}
          </select>
          {obras.length === 0 && (
            <p className="text-xs text-stone-400 mt-1.5">No hay obras cargadas. Creá una obra primero desde la sección Obras.</p>
          )}
        </CardContent>
      </Card>

      {/* Dropzone — solo visible si hay obra seleccionada y no se terminó */}
      {obraId && stage !== "done" && (
        <Dropzone
          onFile={handleFile}
          disabled={stage === "uploading" || !obraId}
          stage={stage}
          file={file}
          loadingText="Importando resumen de obra…"
        />
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
                  {selectedObra && (
                    <p className="text-sm text-emerald-700 mt-0.5">
                      {selectedObra.codigo} — {selectedObra.nombre}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <SummaryCount label="Líneas ppto" value={result.summary.lineasPresupuesto} />
                  <SummaryCount label="Movimientos" value={result.summary.movimientos} />
                  <SummaryCount label="Subcontratos" value={result.summary.subcontratos} />
                  <SummaryCount label="Rubros" value={result.summary.rubros} />
                  <SummaryCount label="Certificaciones" value={result.summary.certificaciones} />
                  <SummaryCount label="Quincenas MO" value={result.summary.quincenas} />
                </div>

                {allWarnings.length > 0 && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 space-y-1.5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 mb-2">
                      <AlertTriangle className="h-4 w-4" />
                      {allWarnings.length} advertencia{allWarnings.length > 1 ? "s" : ""}
                    </div>
                    {allWarnings.map((w, i) => (
                      <p key={i} className="text-xs text-amber-700 font-mono leading-relaxed">{w}</p>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  <Button size="sm" onClick={() => navigate(`/obras/${obraId}/control`)} className="gap-2">
                    <ArrowRight className="h-4 w-4" />
                    Ver control financiero
                  </Button>
                  <Button variant="outline" size="sm" onClick={reset} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Importar otro
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
    </div>
  );
}

/* ─── Página principal ───────────────────────────────────────────────────────── */

export default function ImportPage() {
  const [mode, setMode] = useState<Mode>("resumen");

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Importar datos</h1>
        <p className="text-sm text-stone-500 mt-1">
          Cargá un Excel para actualizar el catálogo de partidas o el control financiero de una obra.
        </p>
      </div>

      {/* Selector de modo */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode("resumen")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border",
            mode === "resumen"
              ? "bg-brand-600 text-white border-brand-600 shadow-sm"
              : "bg-white text-stone-600 border-stone-200 hover:border-brand-300 hover:text-brand-700",
          )}
        >
          <FileText className="h-4 w-4" />
          Resumen de Obra
        </button>
        <button
          onClick={() => setMode("apu")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border",
            mode === "apu"
              ? "bg-brand-600 text-white border-brand-600 shadow-sm"
              : "bg-white text-stone-600 border-stone-200 hover:border-brand-300 hover:text-brand-700",
          )}
        >
          <Layers className="h-4 w-4" />
          APU Unificado
        </button>
      </div>

      {/* Descripción del modo */}
      {mode === "resumen" ? (
        <p className="text-xs text-stone-500 -mt-2">
          Importa el Excel de Resumen de Obra (formato v8): presupuesto congelado, movimientos de Tezamat, subcontratos, quincenas de MO y certificaciones.
        </p>
      ) : (
        <p className="text-xs text-stone-500 -mt-2">
          Importa el catálogo APU Unificado (formato GDR): insumos, partidas y composiciones. También crea el presupuesto generador de la obra.
        </p>
      )}

      {/* Contenido */}
      {mode === "resumen" ? <ResumenFlow /> : <ApuFlow />}
    </div>
  );
}

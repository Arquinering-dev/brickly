import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle,
  XCircle, Loader2, Package, HardHat, Wrench, Building2,
  Layers, RefreshCw, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { cn } from "../lib/cn";

/* ─── Tipos ─────────────────────────────────────────────────────────────────── */

interface ImportResult {
  insumos: {
    materiales: number;
    manoDeObra: number;
    equipos: number;
    subcontratos: number;
    total: number;
  };
  partidas: number;
  composiciones: number;
  warnings: string[];
  errors: string[];
  dryRun: boolean;
  message?: string;
}

type Stage = "idle" | "previewing" | "preview_ok" | "preview_error" | "importing" | "done" | "error";

/* ─── Subcomponentes ─────────────────────────────────────────────────────────── */

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
      <span className={cn("text-sm font-semibold tabular-nums", color)}>
        {value.toLocaleString("es-AR")}
      </span>
    </div>
  );
}

/* ─── Página ─────────────────────────────────────────────────────────────────── */

export default function ImportPage() {
  const [stage, setStage] = useState<Stage>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  /* — Dropzone — */
  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length === 0) return;
    const f = accepted[0];
    setFile(f);
    setPreview(null);
    runPreview(f);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] },
    maxFiles: 1,
    disabled: stage === "previewing" || stage === "importing",
  });

  /* — Preview (dry run) — */
  async function runPreview(f: File) {
    setStage("previewing");
    try {
      const form = new FormData();
      form.append("file", f);
      const res = await apiFetch("/api/import/apu?dry=1", { method: "POST", body: form });
      const data: ImportResult = await res.json();
      setPreview(data);
      setStage(data.errors.length > 0 ? "preview_error" : "preview_ok");
    } catch {
      setStage("error");
      toast.error("No se pudo conectar con el servidor");
    }
  }

  /* — Importar definitivo — */
  async function runImport() {
    if (!file) return;
    setStage("importing");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await apiFetch("/api/import/apu", { method: "POST", body: form });
      const data: ImportResult = await res.json();
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

  /* — Reset — */
  function reset() {
    setStage("idle");
    setFile(null);
    setPreview(null);
    setImportResult(null);
  }

  /* ── Render ── */
  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Importar APU Unificado</h1>
        <p className="text-sm text-stone-500 mt-1">
          Cargá el Excel de APU Unificado (formato GDR) para poblar el catálogo de partidas e insumos.
        </p>
      </div>

      {/* ── DONE ─────────────────────────────────────────────────────────────── */}
      {stage === "done" && importResult && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-4">
                <div>
                  <p className="font-semibold text-emerald-900 text-lg">Importación completada</p>
                  <p className="text-sm text-emerald-700 mt-0.5">
                    El catálogo fue actualizado exitosamente.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white rounded-lg p-3 border border-emerald-100 text-center">
                    <p className="text-2xl font-bold text-stone-900 tabular-nums">
                      {importResult.insumos.total.toLocaleString("es-AR")}
                    </p>
                    <p className="text-xs text-stone-500 mt-0.5">Insumos</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-emerald-100 text-center">
                    <p className="text-2xl font-bold text-stone-900 tabular-nums">
                      {importResult.partidas.toLocaleString("es-AR")}
                    </p>
                    <p className="text-xs text-stone-500 mt-0.5">Partidas APU</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-emerald-100 text-center">
                    <p className="text-2xl font-bold text-stone-900 tabular-nums">
                      {importResult.composiciones.toLocaleString("es-AR")}
                    </p>
                    <p className="text-xs text-stone-500 mt-0.5">Composiciones</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={reset} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Importar otro archivo
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── DROP ZONE ────────────────────────────────────────────────────────── */}
      {stage !== "done" && (
        <div
          {...getRootProps()}
          className={cn(
            "rounded-xl border-2 border-dashed transition-all cursor-pointer p-10 text-center",
            isDragActive
              ? "border-brand-500 bg-brand-50"
              : stage === "previewing" || stage === "importing"
                ? "border-stone-200 bg-stone-50 cursor-default opacity-60"
                : file
                  ? "border-brand-300 bg-brand-50/40"
                  : "border-stone-300 bg-white hover:border-brand-400 hover:bg-brand-50/30"
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-3">
            {stage === "previewing" || stage === "importing" ? (
              <Loader2 className="h-10 w-10 text-brand-500 animate-spin" />
            ) : file ? (
              <FileSpreadsheet className="h-10 w-10 text-brand-500" />
            ) : (
              <Upload className="h-10 w-10 text-stone-400" />
            )}

            <div>
              {stage === "previewing" && (
                <p className="text-sm font-medium text-stone-600">Analizando archivo…</p>
              )}
              {stage === "importing" && (
                <p className="text-sm font-medium text-stone-600">Importando al catálogo…</p>
              )}
              {(stage === "idle" || stage === "error") && !file && (
                <>
                  <p className="text-sm font-medium text-stone-700">
                    {isDragActive ? "Soltá el archivo acá" : "Arrastrá el archivo o hacé click para seleccionar"}
                  </p>
                  <p className="text-xs text-stone-400 mt-1">Solo archivos .xlsx — APU Unificado (formato GDR)</p>
                </>
              )}
              {(stage === "preview_ok" || stage === "preview_error") && file && (
                <>
                  <p className="text-sm font-medium text-stone-700">{file.name}</p>
                  <p className="text-xs text-stone-400 mt-1">
                    Soltá otro archivo para reemplazar
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── PREVIEW RESULT ───────────────────────────────────────────────────── */}
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
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              {/* Insumos */}
              <div className="rounded-lg border border-stone-200 p-4">
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Insumos</p>
                <StatRow icon={Package} label="Materiales" value={preview.insumos.materiales} color="text-blue-500" />
                <StatRow icon={HardHat} label="Mano de Obra" value={preview.insumos.manoDeObra} color="text-amber-500" />
                <StatRow icon={Wrench} label="Equipos" value={preview.insumos.equipos} color="text-violet-500" />
                <StatRow icon={Building2} label="Subcontratos" value={preview.insumos.subcontratos} color="text-teal-500" />
                <div className="flex items-center justify-between pt-2 mt-1">
                  <span className="text-xs font-bold text-stone-500 uppercase">Total</span>
                  <span className="text-sm font-bold text-stone-900 tabular-nums">
                    {preview.insumos.total.toLocaleString("es-AR")}
                  </span>
                </div>
              </div>

              {/* Partidas + Composiciones */}
              <div className="rounded-lg border border-stone-200 p-4 space-y-2">
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Catálogo</p>
                <div className="flex items-center justify-between py-2 border-b border-stone-100">
                  <div className="flex items-center gap-2 text-sm text-stone-600">
                    <Layers className="h-4 w-4 text-brand-500" />
                    Partidas APU
                  </div>
                  <span className="text-sm font-semibold text-stone-900 tabular-nums">
                    {preview.partidas.toLocaleString("es-AR")}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2 text-sm text-stone-600">
                    <Layers className="h-4 w-4 text-stone-400" />
                    Composiciones
                  </div>
                  <span className="text-sm font-semibold text-stone-900 tabular-nums">
                    {preview.composiciones.toLocaleString("es-AR")}
                  </span>
                </div>

                <div className="mt-4 pt-3 border-t border-stone-100">
                  <p className="text-xs text-stone-400 leading-relaxed">
                    La importación hace <strong>upsert</strong> por código — si el catálogo ya tiene datos,
                    actualiza precios y composiciones sin crear duplicados.
                  </p>
                </div>
              </div>
            </div>

            {/* Errores */}
            {preview.errors.length > 0 && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-red-700 mb-2">
                  <XCircle className="h-4 w-4" />
                  {preview.errors.length} error{preview.errors.length > 1 ? "es" : ""} — bloqueante{preview.errors.length > 1 ? "s" : ""}
                </div>
                {preview.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-600 font-mono leading-relaxed">{e}</p>
                ))}
              </div>
            )}

            {/* Warnings */}
            {preview.warnings.length > 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  {preview.warnings.length} advertencia{preview.warnings.length > 1 ? "s" : ""} — no bloquean la importación
                </div>
                {preview.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-700 font-mono leading-relaxed">{w}</p>
                ))}
              </div>
            )}

            {/* CTA */}
            {preview.errors.length === 0 && (
              <div className="flex justify-end pt-2">
                <Button onClick={runImport} className="gap-2" size="lg">
                  Importar al catálogo
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

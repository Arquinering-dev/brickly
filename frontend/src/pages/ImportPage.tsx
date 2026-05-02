import { useState, useRef, DragEvent, ChangeEvent } from "react";

interface ImportSummary {
  apuId: string;
  materiales: number;
  manosDeObra: number;
  equipos: number;
  partidas: number;
  composiciones: number;
  presupuestoLineas: number;
}

interface ParseError {
  sheet: string;
  row?: number;
  field?: string;
  message: string;
}

type Status = "idle" | "uploading" | "success" | "error";

export default function ImportPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [warnings, setWarnings] = useState<ParseError[]>([]);
  const [errors, setErrors] = useState<ParseError[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.name.endsWith(".xlsx")) {
      setErrors([{ sheet: "FILE", message: "Solo se aceptan archivos .xlsx" }]);
      setStatus("error");
      return;
    }
    setFile(f);
    setStatus("idle");
    setErrors([]);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const upload = async () => {
    if (!file) return;
    setStatus("uploading");
    setProgress(10);
    setSummary(null);
    setErrors([]);
    setWarnings([]);

    const formData = new FormData();
    formData.append("file", file);

    // Simulate progress while uploading
    const tick = setInterval(() => {
      setProgress((p) => Math.min(p + 15, 85));
    }, 400);

    try {
      const res = await fetch("/api/apu/import", { method: "POST", body: formData });
      clearInterval(tick);
      setProgress(100);

      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        setWarnings(data.warnings ?? []);
        setStatus("success");
      } else {
        const data = await res.json();
        setErrors(data.errors ?? [{ sheet: "API", message: data.error ?? "Error desconocido" }]);
        setStatus("error");
      }
    } catch {
      clearInterval(tick);
      setErrors([{ sheet: "NETWORK", message: "No se pudo conectar al servidor" }]);
      setStatus("error");
    }
  };

  const reset = () => {
    setStatus("idle");
    setFile(null);
    setSummary(null);
    setErrors([]);
    setWarnings([]);
    setProgress(0);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Importar APU</h1>
      <p className="text-gray-500 text-sm mb-6">
        Subí el archivo Excel del Análisis de Precios Unitarios (.xlsx)
      </p>

      {/* Dropzone */}
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          file
            ? "border-brand-400 bg-brand-50"
            : "border-gray-300 hover:border-brand-400 hover:bg-brand-50"
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={onFileChange}
        />
        {file ? (
          <div>
            <p className="text-2xl mb-1">📄</p>
            <p className="font-medium text-gray-800">{file.name}</p>
            <p className="text-xs text-gray-400 mt-1">
              {(file.size / 1024).toFixed(0)} KB — hacé clic para cambiar
            </p>
          </div>
        ) : (
          <div>
            <p className="text-4xl mb-2">📂</p>
            <p className="text-gray-600 font-medium">Arrastrá el archivo acá</p>
            <p className="text-xs text-gray-400 mt-1">o hacé clic para buscar</p>
          </div>
        )}
      </div>

      {/* Progress */}
      {status === "uploading" && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Procesando…</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-brand-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex gap-3">
        <button
          onClick={upload}
          disabled={!file || status === "uploading"}
          className="px-5 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {status === "uploading" ? "Importando…" : "Importar"}
        </button>
        {(file || status !== "idle") && (
          <button
            onClick={reset}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Success summary */}
      {status === "success" && summary && (
        <div className="mt-6">
          <div className="flex items-center gap-2 text-green-700 font-medium mb-3">
            <span>✅</span> Importación completada
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Materiales", value: summary.materiales },
              { label: "Mano de obra", value: summary.manosDeObra },
              { label: "Equipos", value: summary.equipos },
              { label: "Partidas", value: summary.partidas },
              { label: "Composiciones", value: summary.composiciones },
              { label: "Líneas ppto.", value: summary.presupuestoLineas },
            ].map((item) => (
              <div
                key={item.label}
                className="bg-white border border-gray-200 rounded-lg p-3 text-center"
              >
                <p className="text-2xl font-bold text-brand-600">{item.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm font-medium text-yellow-800 mb-2">
            ⚠️ {warnings.length} advertencia{warnings.length > 1 ? "s" : ""}
          </p>
          <ul className="text-xs text-yellow-700 space-y-1">
            {warnings.map((w, i) => (
              <li key={i}>
                [{w.sheet}]{w.row ? ` fila ${w.row}` : ""}: {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Errors */}
      {status === "error" && errors.length > 0 && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm font-medium text-red-800 mb-2">
            ❌ Error en la importación
          </p>
          <ul className="text-xs text-red-700 space-y-1">
            {errors.map((e, i) => (
              <li key={i}>
                [{e.sheet}]{e.row ? ` fila ${e.row}` : ""}: {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

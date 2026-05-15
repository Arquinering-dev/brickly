import { apiFetch } from "../lib/api";
import { useState, useRef, useEffect, DragEvent, ChangeEvent } from "react";

interface Obra {
  id: string;
  nombre: string;
  codigo: string;
}

interface UnifiedSummary {
  insumos: number;
  partidas: number;
  composiciones: number;
  lineasPresupuesto: number;
  obraNombre: string;
  warnings: string[];
  errores: string[];
}

interface APUSummary {
  insumos: number;
  partidas: number;
  composiciones: number;
  errores: string[];
}

interface PresupuestoSummary {
  lineas: number;
  vinculadas: number;
  sinVincular: number;
  errores: string[];
}

interface ParseError {
  sheet: string;
  row?: number;
  message: string;
}

type UploadStatus = "idle" | "uploading" | "success" | "error";

function Dropzone({
  file,
  onFile,
  label,
}: {
  file: File | null;
  onFile: (f: File) => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  };
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
  };
  return (
    <div
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => ref.current?.click()}
      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
        file ? "border-brand-400 bg-brand-50" : "border-gray-300 hover:border-brand-400 hover:bg-brand-50"
      }`}
    >
      <input ref={ref} type="file" accept=".xlsx" className="hidden" onChange={onChange} />
      {file ? (
        <div>
          <p className="text-xl mb-1">📄</p>
          <p className="font-medium text-gray-800 text-sm">{file.name}</p>
          <p className="text-xs text-gray-400 mt-1">{(file.size / 1024).toFixed(0)} KB — clic para cambiar</p>
        </div>
      ) : (
        <div>
          <p className="text-3xl mb-2">📂</p>
          <p className="text-gray-600 font-medium text-sm">{label}</p>
          <p className="text-xs text-gray-400 mt-1">o clic para buscar</p>
        </div>
      )}
    </div>
  );
}

function UnifiedCard() {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<UnifiedSummary | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const upload = async () => {
    if (!file) return;
    setStatus("uploading");
    setSummary(null);
    setErrors([]);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await apiFetch("/api/import/unificado", { method: "POST", body: form });
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        setStatus("success");
      } else {
        const data = await res.json();
        setErrors([data.error ?? "Error desconocido"]);
        setStatus("error");
      }
    } catch {
      setErrors(["No se pudo conectar al servidor"]);
      setStatus("error");
    }
  };

  const reset = () => { setStatus("idle"); setFile(null); setSummary(null); setErrors([]); };

  return (
    <div className="bg-white rounded-xl border-2 border-brand-200 p-6 col-span-full">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h2 className="font-semibold text-gray-800 text-base">Importar APU Unificado</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Archivo Excel con hojas: CONFIG, MATERIALES, MANO_DE_OBRA, EQUIPOS, SUBCONTRATOS_PRY, PARTIDAS, COMPOSICIÓN, PPTO_GENERADOR
          </p>
        </div>
        <span className="text-xs bg-brand-50 text-brand-600 font-medium px-2 py-0.5 rounded border border-brand-200">
          Estándar
        </span>
      </div>

      <div className="mt-4">
        <Dropzone file={file} onFile={setFile} label="Arrastrá el APU unificado acá (ej: APU_Unificado_GDR3760.xlsx)" />
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={upload}
          disabled={!file || status === "uploading"}
          className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {status === "uploading" ? "Importando…" : "Importar todo"}
        </button>
        {(file || status !== "idle") && (
          <button onClick={reset} className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
            Limpiar
          </button>
        )}
      </div>

      {status === "success" && summary && (
        <div className="mt-4">
          <p className="text-green-700 font-medium text-sm mb-2">
            Importado — obra: <span className="font-bold">{summary.obraNombre}</span>
          </p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Insumos", value: summary.insumos },
              { label: "Partidas APU", value: summary.partidas },
              { label: "Composiciones", value: summary.composiciones },
              { label: "Líneas ppto.", value: summary.lineasPresupuesto },
            ].map((item) => (
              <div key={item.label} className="bg-brand-50 border border-brand-100 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-brand-600">{item.value}</p>
                <p className="text-xs text-gray-500">{item.label}</p>
              </div>
            ))}
          </div>
          {summary.errores.length > 0 && (
            <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs font-medium text-yellow-800 mb-1">{summary.errores.length} error(es)</p>
              <ul className="text-xs text-yellow-700 space-y-0.5 max-h-32 overflow-y-auto">
                {summary.errores.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
          {summary.warnings.length > 0 && (
            <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-600 mb-1">{summary.warnings.length} advertencia(s)</p>
              <ul className="text-xs text-gray-500 space-y-0.5 max-h-24 overflow-y-auto">
                {summary.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {status === "error" && errors.length > 0 && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-xs font-medium text-red-800 mb-1">Error en la importación</p>
          <ul className="text-xs text-red-700 space-y-0.5">
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function APUCard() {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<APUSummary | null>(null);
  const [warnings, setWarnings] = useState<ParseError[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const upload = async () => {
    if (!file) return;
    setStatus("uploading");
    setSummary(null);
    setErrors([]);
    setWarnings([]);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await apiFetch("/api/import/apu", { method: "POST", body: form });
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        setWarnings(data.warnings ?? []);
        setStatus("success");
      } else {
        const data = await res.json();
        setErrors(data.errors?.map((e: ParseError) => `[${e.sheet}] ${e.message}`) ?? [data.error ?? "Error desconocido"]);
        setStatus("error");
      }
    } catch {
      setErrors(["No se pudo conectar al servidor"]);
      setStatus("error");
    }
  };

  const reset = () => {
    setStatus("idle");
    setFile(null);
    setSummary(null);
    setErrors([]);
    setWarnings([]);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="font-semibold text-gray-800 mb-1">Importar APU</h2>
      <p className="text-xs text-gray-500 mb-4">
        Archivo Excel con hojas: MATERIALES, MANO_DE_OBRA, EQUIPOS, PARTIDAS, COMPOSICIÓN
      </p>
      <Dropzone file={file} onFile={setFile} label="Arrastrá el archivo APU acá" />
      <div className="mt-4 flex gap-2">
        <button
          onClick={upload}
          disabled={!file || status === "uploading"}
          className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {status === "uploading" ? "Importando…" : "Importar APU"}
        </button>
        {(file || status !== "idle") && (
          <button onClick={reset} className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
            Limpiar
          </button>
        )}
      </div>

      {status === "success" && summary && (
        <div className="mt-4">
          <p className="text-green-700 font-medium text-sm mb-2">✅ Importación completada</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Insumos", value: summary.insumos },
              { label: "Partidas", value: summary.partidas },
              { label: "Composiciones", value: summary.composiciones },
            ].map((item) => (
              <div key={item.label} className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-brand-600">{item.value}</p>
                <p className="text-xs text-gray-500">{item.label}</p>
              </div>
            ))}
          </div>
          {summary.errores.length > 0 && (
            <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs font-medium text-yellow-800 mb-1">⚠️ {summary.errores.length} advertencia(s)</p>
              <ul className="text-xs text-yellow-700 space-y-0.5 max-h-32 overflow-y-auto">
                {summary.errores.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-xs font-medium text-yellow-800 mb-1">⚠️ {warnings.length} advertencia(s)</p>
          <ul className="text-xs text-yellow-700 space-y-0.5 max-h-28 overflow-y-auto">
            {warnings.map((w, i) => <li key={i}>[{w.sheet}] {w.message}</li>)}
          </ul>
        </div>
      )}

      {status === "error" && errors.length > 0 && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-xs font-medium text-red-800 mb-1">❌ Error en la importación</p>
          <ul className="text-xs text-red-700 space-y-0.5">
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function PresupuestoCard() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [obraId, setObraId] = useState("");
  const [nuevaObra, setNuevaObra] = useState({ nombre: "", codigo: "" });
  const [showNewObra, setShowNewObra] = useState(false);
  const [cacValor, setCacValor] = useState("");
  const [mesCac, setMesCac] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [summary, setSummary] = useState<PresupuestoSummary | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    apiFetch("/api/obras")
      .then((r) => r.json())
      .then((data) => { setObras(data); if (data.length > 0) setObraId(data[0].id); })
      .catch(() => {});
  }, []);

  const crearObra = async () => {
    if (!nuevaObra.nombre || !nuevaObra.codigo) return;
    const res = await apiFetch("/api/obras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nuevaObra),
    });
    if (res.ok) {
      const obra: Obra = await res.json();
      setObras((prev) => [obra, ...prev]);
      setObraId(obra.id);
      setShowNewObra(false);
      setNuevaObra({ nombre: "", codigo: "" });
    }
  };

  const upload = async () => {
    if (!file || !obraId) return;
    setStatus("uploading");
    setSummary(null);
    setErrors([]);
    const form = new FormData();
    form.append("file", file);
    form.append("obraId", obraId);
    form.append("cacValor", cacValor);
    form.append("mesCac", mesCac);
    try {
      const res = await apiFetch("/api/import/presupuesto", { method: "POST", body: form });
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        setStatus("success");
      } else {
        const data = await res.json();
        setErrors([data.error ?? "Error desconocido"]);
        setStatus("error");
      }
    } catch {
      setErrors(["No se pudo conectar al servidor"]);
      setStatus("error");
    }
  };

  const reset = () => { setStatus("idle"); setFile(null); setSummary(null); setErrors([]); };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="font-semibold text-gray-800 mb-1">Importar Presupuesto</h2>
      <p className="text-xs text-gray-500 mb-4">Archivo Excel del presupuesto de obra (hoja "01")</p>

      <div className="space-y-3 mb-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Obra</label>
          <div className="flex gap-2">
            <select
              value={obraId}
              onChange={(e) => setObraId(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              {obras.length === 0 && <option value="">Sin obras — creá una</option>}
              {obras.map((o) => (
                <option key={o.id} value={o.id}>{o.codigo} — {o.nombre}</option>
              ))}
            </select>
            <button
              onClick={() => setShowNewObra((v) => !v)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600"
            >
              {showNewObra ? "Cancelar" : "+ Nueva"}
            </button>
          </div>
        </div>

        {showNewObra && (
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nombre</label>
                <input
                  type="text"
                  value={nuevaObra.nombre}
                  onChange={(e) => setNuevaObra((p) => ({ ...p, nombre: e.target.value }))}
                  placeholder="GDR 3760"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Código</label>
                <input
                  type="text"
                  value={nuevaObra.codigo}
                  onChange={(e) => setNuevaObra((p) => ({ ...p, codigo: e.target.value }))}
                  placeholder="GDR-3760"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
            </div>
            <button
              onClick={crearObra}
              disabled={!nuevaObra.nombre || !nuevaObra.codigo}
              className="px-3 py-1.5 bg-brand-500 text-white text-xs rounded-lg hover:bg-brand-600 disabled:opacity-40"
            >
              Crear obra
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">CAC valor</label>
            <input
              type="number"
              value={cacValor}
              onChange={(e) => setCacValor(e.target.value)}
              placeholder="10902.63"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Mes CAC</label>
            <input
              type="text"
              value={mesCac}
              onChange={(e) => setMesCac(e.target.value)}
              placeholder="DIC-2024"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
        </div>
      </div>

      <Dropzone file={file} onFile={setFile} label="Arrastrá el archivo de presupuesto acá" />

      <div className="mt-4 flex gap-2">
        <button
          onClick={upload}
          disabled={!file || !obraId || status === "uploading"}
          className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {status === "uploading" ? "Importando…" : "Importar Presupuesto"}
        </button>
        {(file || status !== "idle") && (
          <button onClick={reset} className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
            Limpiar
          </button>
        )}
      </div>

      {status === "success" && summary && (
        <div className="mt-4">
          <p className="text-green-700 font-medium text-sm mb-2">✅ Presupuesto importado</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Líneas", value: summary.lineas },
              { label: "Vinculadas", value: summary.vinculadas },
              { label: "Sin vincular", value: summary.sinVincular },
            ].map((item) => (
              <div key={item.label} className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-brand-600">{item.value}</p>
                <p className="text-xs text-gray-500">{item.label}</p>
              </div>
            ))}
          </div>
          {summary.errores.length > 0 && (
            <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs font-medium text-yellow-800 mb-1">⚠️ {summary.errores.length} error(es)</p>
              <ul className="text-xs text-yellow-700 space-y-0.5 max-h-28 overflow-y-auto">
                {summary.errores.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {status === "error" && errors.length > 0 && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-xs font-medium text-red-800 mb-1">❌ Error</p>
          <ul className="text-xs text-red-700 space-y-0.5">
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function ImportPage() {
  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Importar datos</h1>
      <p className="text-gray-500 text-sm mb-6">Importá el archivo APU unificado o usá los importadores individuales</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UnifiedCard />
        <APUCard />
        <PresupuestoCard />
      </div>
    </div>
  );
}

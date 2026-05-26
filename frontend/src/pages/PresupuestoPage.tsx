import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useObras } from "../hooks/useObras";

// ────────────────────────────────────────────────────────────────────────────────
// Helpers
const fmtMoney = (n: number) =>
  n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const fmtNum = (n: number, dec = 2) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });

// ────────────────────────────────────────────────────────────────────────────────
// Tipos compartidos
interface PresupuestoListItem {
  id: string;
  obra: { id: string; nombre: string; codigo: string; estado: string };
  tipo: "GENERADOR" | "APROBADO";
  nombre: string | null;
  version: string | null;
  estado: string;
  mesCac: string;
  cacValor: number;
  coefGGBB: number | null;
  fecha: string;
  fechaInicio: string | null;
  lineasCount: number;
  rubrosCount: number;
  totalCD: number;
  totalPV: number;
  createdAt: string;
}

interface LineaPreview {
  itemNumero: string | null;
  descripcion: string;
  unidad: string;
  cantidad: number;
  matUd: number;
  moUd: number;
  eqUd: number;
  precioUnitario: number;
  precioVenta: number | null;
  rubro: string;
  isRubroRow: boolean;
  cronograma?: number[];
  match?: { partidaId: string; codigo: string; descripcion: string; score: number } | null;
  // Editable state local (no viene del backend)
  partidaId?: string | null;
  crearPartidaObra?: boolean;
}

interface PreviewResult {
  obraDetectada: { nombre: string; codigo: string } | null;
  formato: string;
  hojaUsada: string;
  totales: { totalCD: number; totalPV: number; tareasCount: number; rubrosCount: number };
  lineas: LineaPreview[];
  cronogramaMeses: { mesOrdinal: number; fecha: string | null; etiqueta: string }[];
  warnings: string[];
}

// ────────────────────────────────────────────────────────────────────────────────
// Componente raíz: enruta entre lista / nuevo / detalle
export default function PresupuestoPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const isNew = location.pathname.endsWith("/nuevo");

  if (isNew) return <PresupuestoEditor mode="new" />;
  if (id) return <PresupuestoEditor mode="edit" headerId={id} />;
  return <PresupuestoLista />;
}

// ────────────────────────────────────────────────────────────────────────────────
// LISTA
function PresupuestoLista() {
  const navigate = useNavigate();
  const [items, setItems] = useState<PresupuestoListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTipo, setFilterTipo] = useState<"" | "GENERADOR" | "APROBADO">("");

  const fetchList = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (filterTipo) qs.set("tipo", filterTipo);
    const res = await apiFetch(`/api/presupuestos?${qs}`);
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, [filterTipo]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar este presupuesto? Esta acción es irreversible.")) return;
    await apiFetch(`/api/presupuestos/${id}`, { method: "DELETE" });
    fetchList();
  };

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-950">Presupuestos</h1>
          <p className="text-sm text-gray-500">{items.length} presupuestos</p>
        </div>
        <button
          onClick={() => navigate("/presupuesto/nuevo")}
          className="px-5 py-2.5 bg-brand-500 text-white rounded-lg text-sm font-semibold hover:bg-brand-600 shadow-sm"
        >
          + Nuevo presupuesto
        </button>
      </div>

      <div className="flex gap-2 mb-5">
        {[
          { val: "" as const, label: "Todos" },
          { val: "GENERADOR" as const, label: "Generador" },
          { val: "APROBADO" as const, label: "Aprobado" },
        ].map((f) => (
          <button
            key={f.val || "all"}
            onClick={() => setFilterTipo(f.val)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              filterTipo === f.val ? "bg-brand-500 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400 text-sm">Cargando…</div>
      ) : items.length === 0 ? (
        <div className="py-20 text-center text-gray-400 text-sm">
          Sin presupuestos todavía. Creá uno nuevo para empezar.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate(`/presupuesto/${p.id}`)}
              className="text-left bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-brand-300 transition-all p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  p.tipo === "APROBADO"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-blue-100 text-blue-700"
                }`}>
                  {p.tipo === "APROBADO" ? "APROBADO" : "GENERADOR"}
                </span>
                <span className="text-xs text-gray-400 font-mono">{p.obra.codigo}</span>
              </div>
              <p className="text-base font-bold text-gray-900 mb-1 truncate">{p.obra.nombre}</p>
              <p className="text-xs text-gray-500 mb-4">{p.nombre || "—"}{p.version ? ` · v${p.version}` : ""}</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-gray-400">Costo directo</p>
                  <p className="font-bold text-gray-800">{fmtMoney(p.totalCD)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Precio venta</p>
                  <p className="font-bold text-gray-800">{p.totalPV > 0 ? fmtMoney(p.totalPV) : "—"}</p>
                </div>
                <div>
                  <p className="text-gray-400">Tareas</p>
                  <p className="font-medium text-gray-700">{p.lineasCount}</p>
                </div>
                <div>
                  <p className="text-gray-400">Rubros</p>
                  <p className="font-medium text-gray-700">{p.rubrosCount}</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end">
                <span
                  onClick={(e) => { e.stopPropagation(); eliminar(p.id); }}
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

// ────────────────────────────────────────────────────────────────────────────────
// EDITOR (nuevo o existente)
function PresupuestoEditor({ mode, headerId }: { mode: "new" | "edit"; headerId?: string }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"datos" | "lineas" | "import">(mode === "new" ? "import" : "datos");
  const [tipo, setTipo] = useState<"GENERADOR" | "APROBADO">("GENERADOR");
  const [headerNombre, setHeaderNombre] = useState("");
  const [headerVersion, setHeaderVersion] = useState("");
  const [obraId, setObraId] = useState<string>("");
  const [obraNombre, setObraNombre] = useState("");
  const [obraCodigo, setObraCodigo] = useState("");
  const [existingHeader, setExistingHeader] = useState<PresupuestoListItem | null>(null);
  const [loading, setLoading] = useState(mode === "edit");

  // Cargar header existente
  useEffect(() => {
    if (mode !== "edit" || !headerId) return;
    setLoading(true);
    apiFetch(`/api/presupuestos/${headerId}`)
      .then((r) => r.json())
      .then((data) => {
        setTipo(data.tipo);
        setHeaderNombre(data.nombre ?? "");
        setHeaderVersion(data.version ?? "");
        setObraId(data.obraId);
        setObraNombre(data.obra.nombre);
        setObraCodigo(data.obra.codigo);
        setExistingHeader(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [mode, headerId]);

  if (loading) return <div className="p-8 text-gray-400">Cargando…</div>;

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/presupuesto")} className="text-gray-400 hover:text-gray-700 text-sm">
          ← Presupuestos
        </button>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900">
          {mode === "new" ? "Nuevo presupuesto" : `${obraNombre || "Presupuesto"}${headerVersion ? ` · v${headerVersion}` : ""}`}
        </h1>
      </div>

      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {mode === "new" && (
          <TabBtn active={activeTab === "import"} onClick={() => setActiveTab("import")}>
            1. Importar xlsx
          </TabBtn>
        )}
        <TabBtn active={activeTab === "datos"} onClick={() => setActiveTab("datos")}>
          {mode === "new" ? "2." : ""} Datos
        </TabBtn>
        <TabBtn active={activeTab === "lineas"} onClick={() => setActiveTab("lineas")}>
          {mode === "new" ? "3." : ""} Líneas {existingHeader?.lineasCount ? `(${existingHeader.lineasCount})` : ""}
        </TabBtn>
      </div>

      {activeTab === "import" && mode === "new" && (
        <ImportTab
          tipo={tipo}
          onTipoChange={setTipo}
          obraNombre={obraNombre}
          obraCodigo={obraCodigo}
          headerNombre={headerNombre}
          headerVersion={headerVersion}
          onChange={(o) => {
            setObraNombre(o.obraNombre);
            setObraCodigo(o.obraCodigo);
            setHeaderNombre(o.headerNombre);
            setHeaderVersion(o.headerVersion);
          }}
          onSaved={(headerId) => navigate(`/presupuesto/${headerId}`)}
        />
      )}

      {activeTab === "datos" && (
        <DatosTab
          mode={mode}
          headerId={headerId}
          tipo={tipo}
          setTipo={setTipo}
          nombre={headerNombre}
          setNombre={setHeaderNombre}
          version={headerVersion}
          setVersion={setHeaderVersion}
          obraId={obraId}
          setObraId={setObraId}
          obraNombre={obraNombre}
          setObraNombre={setObraNombre}
          obraCodigo={obraCodigo}
          setObraCodigo={setObraCodigo}
        />
      )}

      {activeTab === "lineas" && mode === "edit" && headerId && (
        <LineasTab headerId={headerId} />
      )}
      {activeTab === "lineas" && mode === "new" && (
        <div className="bg-gray-50 rounded-2xl p-12 text-center text-gray-400 text-sm">
          Primero importá un xlsx o guardá los datos del presupuesto.
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
        active ? "border-brand-500 text-brand-600" : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >
      {children}
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// TAB: Importar xlsx (preview + confirmar)
function ImportTab({
  tipo, onTipoChange, obraNombre, obraCodigo, headerNombre, headerVersion,
  onChange, onSaved,
}: {
  tipo: "GENERADOR" | "APROBADO";
  onTipoChange: (t: "GENERADOR" | "APROBADO") => void;
  obraNombre: string;
  obraCodigo: string;
  headerNombre: string;
  headerVersion: string;
  onChange: (o: { obraNombre: string; obraCodigo: string; headerNombre: string; headerVersion: string }) => void;
  onSaved: (headerId: string) => void;
}) {
  const { obras } = useObras();
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [lineas, setLineas] = useState<LineaPreview[]>([]);
  const [existingObraId, setExistingObraId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const parse = async (f: File) => {
    setParsing(true);
    const fd = new FormData();
    fd.append("file", f);
    fd.append("tipo", tipo);
    const res = await apiFetch("/api/presupuestos/parse-xlsx", { method: "POST", body: fd });
    if (res.ok) {
      const data: PreviewResult = await res.json();
      setPreview(data);
      // Inicializar estado editable de líneas (partidaId desde match)
      setLineas(data.lineas.map((l) => ({
        ...l,
        partidaId: l.match?.partidaId ?? null,
        crearPartidaObra: !l.isRubroRow && !l.match,
      })));
      // Pre-llenar obra detectada si no existe en BD
      if (data.obraDetectada) {
        const existente = obras.find((o) => o.codigo === data.obraDetectada!.codigo);
        if (existente) setExistingObraId(existente.id);
        onChange({
          obraNombre: data.obraDetectada.nombre,
          obraCodigo: data.obraDetectada.codigo,
          headerNombre,
          headerVersion,
        });
      }
    }
    setParsing(false);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); parse(f); }
  };

  const stats = useMemo(() => {
    if (!preview) return null;
    const tareas = lineas.filter((l) => !l.isRubroRow);
    const conMatch = tareas.filter((l) => l.partidaId && !l.crearPartidaObra).length;
    const nuevas = tareas.filter((l) => l.crearPartidaObra).length;
    return { tareas: tareas.length, conMatch, nuevas, rubros: preview.totales.rubrosCount };
  }, [preview, lineas]);

  const confirmar = async () => {
    if (!preview) return;
    setSaving(true);
    const body = {
      tipo,
      obraId: existingObraId || undefined,
      obraNombre: existingObraId ? undefined : obraNombre,
      obraCodigo: existingObraId ? undefined : obraCodigo,
      nombre: headerNombre || preview.obraDetectada?.nombre || null,
      version: headerVersion || null,
      lineas,
      cronogramaMeses: preview.cronogramaMeses,
    };
    const res = await apiFetch("/api/presupuestos/confirmar-import", {
      method: "POST",
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      onSaved(data.header.id);
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "Error al guardar");
    }
  };

  return (
    <div className="space-y-5">
      {!preview && (
        <>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">Tipo de presupuesto</p>
            <div className="flex gap-2 mb-4">
              {(["GENERADOR", "APROBADO"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => onTipoChange(t)}
                  className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
                    tipo === t ? "bg-brand-500 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {t === "GENERADOR" ? "Generador (estimación)" : "Aprobado (precio venta + cronograma)"}
                </button>
              ))}
            </div>
            <label className="block">
              <div className="border-2 border-dashed border-gray-300 rounded-2xl p-10 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 transition-colors">
                <p className="text-sm font-medium text-gray-700 mb-1">
                  {parsing ? "Procesando…" : "Arrastrá o clickeá para subir el .xlsx"}
                </p>
                <p className="text-xs text-gray-400">
                  {tipo === "GENERADOR"
                    ? "Presupuesto de obra calculado (formato GDR / Arquinering)"
                    : "Presupuesto aprobado con precio venta y cronograma mes a mes"}
                </p>
                <input type="file" accept=".xlsx" className="hidden" onChange={onFileChange} />
              </div>
            </label>
          </div>
        </>
      )}

      {preview && (
        <>
          {/* Banner resumen */}
          <div className="bg-gradient-to-br from-brand-500 to-brand-600 text-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-brand-100 mb-1">
                  Archivo · hoja "{preview.hojaUsada}"
                </p>
                <p className="text-lg font-bold">{file?.name}</p>
                <p className="text-sm text-brand-100">
                  Formato: {preview.formato} · {tipo}
                </p>
              </div>
              {stats && (
                <div className="grid grid-cols-4 gap-6 text-center">
                  <Stat label="Rubros" value={stats.rubros} />
                  <Stat label="Tareas" value={stats.tareas} />
                  <Stat label="Match APU" value={stats.conMatch} accent="emerald" />
                  <Stat label="Nuevas" value={stats.nuevas} accent="amber" />
                </div>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
              <div>
                <p className="text-xs text-brand-100">Costo directo total</p>
                <p className="text-xl font-bold">{fmtMoney(preview.totales.totalCD)}</p>
              </div>
              <div>
                <p className="text-xs text-brand-100">Precio venta total</p>
                <p className="text-xl font-bold">
                  {preview.totales.totalPV > 0 ? fmtMoney(preview.totales.totalPV) : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Datos obra */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">Obra</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Obra existente</label>
                <select value={existingObraId} onChange={(e) => setExistingObraId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                  <option value="">— Crear nueva —</option>
                  {obras.map((o) => <option key={o.id} value={o.id}>{o.codigo} · {o.nombre}</option>)}
                </select>
              </div>
              {!existingObraId && (
                <>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Nombre</label>
                    <input value={obraNombre}
                      onChange={(e) => onChange({ obraNombre: e.target.value, obraCodigo, headerNombre, headerVersion })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Código</label>
                    <input value={obraCodigo}
                      onChange={(e) => onChange({ obraNombre, obraCodigo: e.target.value, headerNombre, headerVersion })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                  </div>
                </>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nombre del presupuesto</label>
                <input value={headerNombre}
                  onChange={(e) => onChange({ obraNombre, obraCodigo, headerNombre: e.target.value, headerVersion })}
                  placeholder="ej: Presupuesto inicial obra civil"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Versión</label>
                <input value={headerVersion}
                  onChange={(e) => onChange({ obraNombre, obraCodigo, headerNombre, headerVersion: e.target.value })}
                  placeholder="ej: 01"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
            </div>
          </div>

          {/* Tabla preview con bucket switches */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <p className="text-sm font-semibold text-gray-700">Vista previa · {lineas.length} filas</p>
              <p className="text-xs text-gray-500">Verificá que cada tarea esté correctamente mapeada. Las partidas sin match se crearán como específicas de la obra.</p>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white border-b border-gray-200">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-500 text-xs">Item</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500 text-xs">Descripción</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500 text-xs">U</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-500 text-xs">Cant</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-500 text-xs">P. Unit</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-500 text-xs">Total</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500 text-xs">Destino</th>
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l, idx) => l.isRubroRow ? (
                    <tr key={idx} className="bg-gray-50 border-t border-gray-100">
                      <td className="px-3 py-2 font-mono text-xs text-gray-500">{l.itemNumero}</td>
                      <td colSpan={6} className="px-3 py-2 text-xs font-bold text-gray-700 uppercase">{l.descripcion}</td>
                    </tr>
                  ) : (
                    <tr key={idx} className="border-t border-gray-50 hover:bg-gray-50/50">
                      <td className="px-3 py-2 font-mono text-xs text-gray-500">{l.itemNumero}</td>
                      <td className="px-3 py-2 text-gray-700 max-w-md truncate" title={l.descripcion}>{l.descripcion}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{l.unidad}</td>
                      <td className="px-3 py-2 text-right text-gray-700 text-xs">{fmtNum(l.cantidad, 2)}</td>
                      <td className="px-3 py-2 text-right text-gray-700 text-xs">{fmtMoney(l.precioUnitario)}</td>
                      <td className="px-3 py-2 text-right font-medium text-gray-800 text-xs">{fmtMoney(l.cantidad * l.precioUnitario)}</td>
                      <td className="px-3 py-2">
                        {l.match && l.partidaId === l.match.partidaId && !l.crearPartidaObra ? (
                          <button
                            onClick={() => setLineas((arr) => arr.map((x, i) => i === idx ? { ...x, partidaId: null, crearPartidaObra: true } : x))}
                            className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded hover:bg-emerald-100"
                            title={`Match ${(l.match.score * 100).toFixed(0)}%: ${l.match.descripcion}`}
                          >
                            ✓ APU {l.match.codigo}
                          </button>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded">
                              Nueva (obra)
                            </span>
                            {l.match && (
                              <button
                                onClick={() => setLineas((arr) => arr.map((x, i) => i === idx ? { ...x, partidaId: l.match!.partidaId, crearPartidaObra: false } : x))}
                                className="text-xs text-brand-600 hover:underline"
                                title={`Usar match: ${l.match.descripcion}`}
                              >
                                · usar {l.match.codigo}
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <button
              onClick={() => { setPreview(null); setFile(null); setLineas([]); }}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              ← Subir otro archivo
            </button>
            <button
              onClick={confirmar}
              disabled={saving || (!existingObraId && (!obraNombre || !obraCodigo))}
              className="px-6 py-2.5 bg-brand-500 text-white rounded-lg font-semibold hover:bg-brand-600 disabled:opacity-50 shadow-sm"
            >
              {saving ? "Guardando…" : "Confirmar e importar"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: "emerald" | "amber" }) {
  return (
    <div>
      <p className={`text-2xl font-black ${accent === "emerald" ? "text-emerald-200" : accent === "amber" ? "text-amber-200" : ""}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-brand-100">{label}</p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// TAB: Datos (editar header)
function DatosTab({
  mode, headerId, tipo, setTipo, nombre, setNombre, version, setVersion,
  obraId, setObraId, obraNombre, setObraNombre, obraCodigo, setObraCodigo,
}: {
  mode: "new" | "edit";
  headerId?: string;
  tipo: "GENERADOR" | "APROBADO";
  setTipo: (t: "GENERADOR" | "APROBADO") => void;
  nombre: string;
  setNombre: (s: string) => void;
  version: string;
  setVersion: (s: string) => void;
  obraId: string;
  setObraId: (s: string) => void;
  obraNombre: string;
  setObraNombre: (s: string) => void;
  obraCodigo: string;
  setObraCodigo: (s: string) => void;
}) {
  const { obras } = useObras();
  const [saving, setSaving] = useState(false);

  const guardar = async () => {
    if (mode === "edit" && headerId) {
      setSaving(true);
      await apiFetch(`/api/presupuestos/${headerId}`, {
        method: "PUT",
        body: JSON.stringify({ nombre, version }),
      });
      setSaving(false);
    } else {
      // En modo new se crea solo desde el tab importar
      alert("Subí un xlsx desde la pestaña Importar para crear el presupuesto");
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Tipo</label>
        <div className="flex gap-2">
          {(["GENERADOR", "APROBADO"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTipo(t)}
              disabled={mode === "edit"}
              className={`px-4 py-2 text-sm rounded-lg font-medium ${
                tipo === t ? "bg-brand-500 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"
              } disabled:opacity-60`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Nombre</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Versión</label>
          <input value={version} onChange={(e) => setVersion(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Obra</label>
        {mode === "edit" ? (
          <p className="text-sm text-gray-700">{obraNombre} <span className="text-gray-400 font-mono">({obraCodigo})</span></p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select value={obraId} onChange={(e) => setObraId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
              <option value="">— Crear nueva —</option>
              {obras.map((o) => <option key={o.id} value={o.id}>{o.codigo} · {o.nombre}</option>)}
            </select>
            {!obraId && (
              <>
                <input value={obraNombre} onChange={(e) => setObraNombre(e.target.value)} placeholder="Nombre obra"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                <input value={obraCodigo} onChange={(e) => setObraCodigo(e.target.value)} placeholder="Código obra"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button onClick={guardar} disabled={saving}
          className="px-5 py-2 bg-brand-500 text-white rounded-lg text-sm font-semibold hover:bg-brand-600 disabled:opacity-50">
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// TAB: Líneas (vista del presupuesto guardado)
interface LineaDB {
  id: string;
  itemNumero: string | null;
  rubro: string;
  cantidad: string;
  precioUnitarioSnapshot: string;
  precioVenta: string | null;
  partidaId: string | null;
  descripcionLibre: string | null;
  partida: { id: string; codigo: string; descripcion: string; unidad: string; scope: string } | null;
  matUd: string | null;
  moUd: string | null;
  eqUd: string | null;
}

function LineasTab({ headerId }: { headerId: string }) {
  const [lineas, setLineas] = useState<LineaDB[]>([]);
  const [tipo, setTipo] = useState<"GENERADOR" | "APROBADO">("GENERADOR");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/presupuestos/${headerId}`)
      .then((r) => r.json())
      .then((data) => { setLineas(data.lineas); setTipo(data.tipo); setLoading(false); });
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
  const totalPV = lineas.reduce((s, l) => s + Number(l.cantidad) * Number(l.precioVenta ?? 0), 0);

  if (loading) return <div className="text-gray-400 text-sm">Cargando líneas…</div>;

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 text-white rounded-2xl p-5 shadow-sm grid grid-cols-3 gap-6">
        <div>
          <p className="text-xs uppercase text-gray-400 mb-1">Tareas</p>
          <p className="text-2xl font-black">{lineas.length}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-gray-400 mb-1">Costo directo</p>
          <p className="text-2xl font-black">{fmtMoney(totalCD)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-gray-400 mb-1">Precio venta</p>
          <p className="text-2xl font-black">{tipo === "APROBADO" ? fmtMoney(totalPV) : "—"}</p>
        </div>
      </div>

      {rubros.map((r) => (
        <div key={r.nombre} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-800 text-sm uppercase">{r.nombre}</h3>
            <span className="text-sm font-semibold text-gray-700">{fmtMoney(r.total)}</span>
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500">
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-2 font-medium">Item</th>
                <th className="text-left px-4 py-2 font-medium">Partida</th>
                <th className="text-left px-4 py-2 font-medium">Origen</th>
                <th className="text-right px-4 py-2 font-medium">Cant</th>
                <th className="text-right px-4 py-2 font-medium">P. Unit</th>
                <th className="text-right px-4 py-2 font-medium">Total</th>
                {tipo === "APROBADO" && <th className="text-right px-4 py-2 font-medium">P. Venta</th>}
              </tr>
            </thead>
            <tbody>
              {r.lineas.map((l) => (
                <tr key={l.id} className="border-b border-gray-50">
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">{l.itemNumero}</td>
                  <td className="px-4 py-2 text-gray-800">
                    {l.partida?.descripcion ?? l.descripcionLibre ?? "—"}
                    {l.partida && <span className="ml-2 text-xs font-mono text-gray-400">{l.partida.codigo}</span>}
                  </td>
                  <td className="px-4 py-2">
                    {l.partida?.scope === "OBRA" ? (
                      <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded">Obra</span>
                    ) : l.partida?.scope === "APU" ? (
                      <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">APU</span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right text-xs">{fmtNum(Number(l.cantidad), 2)} {l.partida?.unidad ?? ""}</td>
                  <td className="px-4 py-2 text-right text-xs">{fmtMoney(Number(l.precioUnitarioSnapshot))}</td>
                  <td className="px-4 py-2 text-right font-medium">
                    {fmtMoney(Number(l.cantidad) * Number(l.precioUnitarioSnapshot))}
                  </td>
                  {tipo === "APROBADO" && (
                    <td className="px-4 py-2 text-right text-xs text-emerald-700">
                      {l.precioVenta ? fmtMoney(Number(l.precioVenta) * Number(l.cantidad)) : "—"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

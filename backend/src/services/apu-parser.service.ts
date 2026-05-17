import * as XLSX from "xlsx";

export interface InsumoRow {
  codigo: string;
  descripcion: string;
  tipo: "MATERIAL" | "MANO_DE_OBRA" | "EQUIPO" | "SUBCONTRATO";
  unidad: string;
  precioReferencia: number;
  proveedor?: string;
  categoria?: string;
  codigoOriginal?: string;
  fechaCotizacion?: Date;
}

export interface PartidaRow {
  codigo: string;
  rubro: string;
  descripcion: string;
  unidad: string;
  rendimiento: number;
}

export interface ComposicionRow {
  partidaCodigo: string;
  tipo: "MATERIAL" | "MANO_DE_OBRA" | "EQUIPO" | "SUBCONTRATO";
  insumoCodigo: string;
  cantidadPorUnidad: number;
  pctDesperdicio: number;
  secuencia: number;
}

export interface ParsedAPU {
  insumos: InsumoRow[];
  partidas: PartidaRow[];
  composiciones: ComposicionRow[];
}

export interface ParseError {
  sheet: string;
  row?: number;
  field?: string;
  message: string;
}

const REQUIRED_SHEETS = ["MATERIALES", "MANO_DE_OBRA", "EQUIPOS", "PARTIDAS", "COMPOSICIÓN"];
const OPTIONAL_SHEETS = ["SUBCONTRATOS_PRY"];

function safeStr(val: unknown, fallback = ""): string {
  if (val === null || val === undefined) return fallback;
  return String(val).trim();
}

function safeNum(val: unknown, fallback = 0): number {
  if (val === null || val === undefined || val === "") return fallback;
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

function sheetToRows(sheet: XLSX.WorkSheet): Record<string, unknown>[] {
  return XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });
}

function getField(
  row: Record<string, unknown>,
  names: string[],
  pos: number
): unknown {
  const keys = Object.keys(row);
  const vals = Object.values(row);
  for (const name of names) {
    const idx = keys.findIndex((k) =>
      k.toLowerCase().replace(/[^a-z0-9]/g, "").includes(
        name.toLowerCase().replace(/[^a-z0-9]/g, "")
      )
    );
    if (idx !== -1) return vals[idx];
  }
  return vals[pos] ?? null;
}

function parseMateriales(sheet: XLSX.WorkSheet, errors: ParseError[]): InsumoRow[] {
  const rows = sheetToRows(sheet);
  const result: InsumoRow[] = [];
  rows.forEach((row, i) => {
    const codigo = safeStr(getField(row, ["código", "codigo", "code"], 0));
    if (!codigo) return;
    const precio = safeNum(getField(row, ["precio", "price", "costo", "valor"], 3));
    if (isNaN(precio)) {
      errors.push({ sheet: "MATERIALES", row: i + 2, field: "precio", message: `Precio inválido en fila ${i + 2}, código ${codigo}` });
    }
    const fechaRaw = getField(row, ["fecha", "cotiz", "date"], 5);
    let fechaCotizacion: Date | undefined;
    if (fechaRaw) {
      const d = new Date(String(fechaRaw));
      if (!isNaN(d.getTime())) fechaCotizacion = d;
    }
    result.push({
      codigo,
      descripcion: safeStr(getField(row, ["descripción", "descripcion", "desc", "nombre"], 1)),
      tipo: "MATERIAL",
      unidad: safeStr(getField(row, ["unidad", "ud", "unit"], 2)),
      precioReferencia: precio,
      proveedor: safeStr(getField(row, ["proveedor", "prov", "supplier"], 4)) || undefined,
      categoria: safeStr(getField(row, ["categoría", "categoria", "cat", "category"], 6)) || undefined,
      codigoOriginal: safeStr(getField(row, ["cód. original", "cod original", "codoriginal", "original"], 7)) || undefined,
      fechaCotizacion,
    });
  });
  return result;
}

function parseManoDeObra(sheet: XLSX.WorkSheet, errors: ParseError[]): InsumoRow[] {
  const rows = sheetToRows(sheet);
  const result: InsumoRow[] = [];
  rows.forEach((_row, i) => {
    const row = _row;
    const codigo = safeStr(getField(row, ["código", "codigo"], 0));
    if (!codigo) return;
    // MO sheets typically have no "unidad" column — salary is always per jornal.
    // Do NOT fall back to col 2 (that's the price column).
    const unidadExplicita = safeStr(getField(row, ["unidad", "ud"], -1));
    result.push({
      codigo,
      descripcion: safeStr(getField(row, ["descripción", "descripcion"], 1)),
      tipo: "MANO_DE_OBRA",
      unidad: unidadExplicita || "jornal",
      precioReferencia: safeNum(getField(row, ["salario", "sueldo", "jornal", "costo", "precio"], 2)),
    });
  });
  return result;
}

function parseEquipos(sheet: XLSX.WorkSheet, errors: ParseError[]): InsumoRow[] {
  const rows = sheetToRows(sheet);
  const result: InsumoRow[] = [];
  rows.forEach((_row, i) => {
    const row = _row;
    const codigo = safeStr(getField(row, ["código", "codigo"], 0));
    if (!codigo) return;
    // EQ sheets have no consistent "unidad" column — col 2 is often a quantity or empty.
    // Do NOT fall back to col 2; default to "día" (equipment is always per day).
    const unidadExplicita = safeStr(getField(row, ["unidad", "ud"], -1));
    result.push({
      codigo,
      descripcion: safeStr(getField(row, ["descripción", "descripcion"], 1)),
      tipo: "EQUIPO",
      unidad: unidadExplicita || "día",
      precioReferencia: safeNum(
        getField(row, ["precio/día", "precio/dia", "preciodia", "precio dia", "precio por dia", "precio"], 5) ??
        getField(row, ["costo/día", "costo/dia", "costodia", "costo dia"], 5) ??
        getField(row, ["costo total", "costoTotal"], 2)
      ),
    });
  });
  return result;
}

function parsePartidas(sheet: XLSX.WorkSheet, errors: ParseError[]): PartidaRow[] {
  const rows = sheetToRows(sheet);
  const result: PartidaRow[] = [];
  rows.forEach((row) => {
    const codigo = safeStr(getField(row, ["código", "codigo"], 0));
    if (!codigo) return;
    result.push({
      codigo,
      rubro: safeStr(getField(row, ["rubro"], 1)),
      descripcion: safeStr(getField(row, ["descripción", "descripcion", "desc"], 2)),
      unidad: safeStr(getField(row, ["unidad", "ud"], 3)),
      rendimiento: safeNum(getField(row, ["rendimiento", "rend"], 4), 1),
    });
  });
  return result;
}

function generateSubCode(rubro: string, tarea: string): string {
  const rubroSlug = rubro.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  const tareaSlug = tarea.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  return `SC-${rubroSlug}-${tareaSlug}`;
}

function parseSubcontratos(sheet: XLSX.WorkSheet, errors: ParseError[]): InsumoRow[] {
  const rows = sheetToRows(sheet);
  const result: InsumoRow[] = [];
  const seenCodes = new Set<string>();
  rows.forEach((row, i) => {
    const rubro = safeStr(getField(row, ["rubro"], 0));
    const tarea = safeStr(getField(row, ["tarea"], 1));
    if (!rubro || !tarea) return;
    const precio = safeNum(getField(row, ["pu actualizado", "precio", "importe"], 4));
    if (precio <= 0) {
      errors.push({ sheet: "SUBCONTRATOS", row: i + 2, field: "precio", message: `Precio inválido en fila ${i + 2}, ${rubro}/${tarea}` });
    }
    let codigo = generateSubCode(rubro, tarea);
    // resolve collisions by appending a counter suffix
    if (seenCodes.has(codigo)) {
      let suffix = 2;
      while (seenCodes.has(`${codigo}-${suffix}`)) suffix++;
      codigo = `${codigo}-${suffix}`;
    }
    seenCodes.add(codigo);
    const fechaStr = safeStr(getField(row, ["fecha act", "fecha actualiz"], 5));
    const fechaCotizacion = fechaStr ? new Date(fechaStr) : undefined;
    result.push({
      codigo,
      descripcion: tarea,
      tipo: "SUBCONTRATO" as InsumoRow["tipo"],
      unidad: safeStr(getField(row, ["ud", "unidad"], 3)) || "gl",
      precioReferencia: precio,
      proveedor: safeStr(getField(row, ["contratista", "proveedor"], 2)) || undefined,
      categoria: rubro,
      codigoOriginal: `${rubro}|${tarea}`,
      fechaCotizacion: fechaCotizacion && !isNaN(fechaCotizacion.getTime()) ? fechaCotizacion : undefined,
    });
  });
  return result;
}

function parseSubcontratosPRY(sheet: XLSX.WorkSheet, errors: ParseError[]): InsumoRow[] {
  const rows = sheetToRows(sheet);
  const result: InsumoRow[] = [];
  rows.forEach((row, i) => {
    const codigo = safeStr(getField(row, ["código", "codigo"], 0));
    if (!codigo || !codigo.startsWith("SUB-")) return;
    const precio = safeNum(getField(row, ["precio", "precio unitario", "importe"], 3));
    if (precio <= 0) {
      errors.push({ sheet: "SUBCONTRATOS_PRY", row: i + 2, field: "precio", message: `Precio inválido en fila ${i + 2}, código ${codigo}` });
    }
    result.push({
      codigo,
      descripcion: safeStr(getField(row, ["descripción", "descripcion", "tarea", "desc"], 1)),
      tipo: "SUBCONTRATO" as InsumoRow["tipo"],
      unidad: safeStr(getField(row, ["ud", "unidad", "unit"], 2)) || "gl",
      precioReferencia: precio,
      categoria: safeStr(getField(row, ["categoría", "categoria", "cat"], 4)) || undefined,
    });
  });
  return result;
}

function parseComposicion(sheet: XLSX.WorkSheet, errors: ParseError[]): ComposicionRow[] {
  const rows = sheetToRows(sheet);
  const result: ComposicionRow[] = [];
  rows.forEach((row) => {
    const partidaCodigo = safeStr(getField(row, ["partida", "código partida", "cod partida", "codPartida"], 0));
    if (!partidaCodigo) return;

    const tipoRaw = safeStr(getField(row, ["tipo"], 1)).toUpperCase();
    let tipo: "MATERIAL" | "MANO_DE_OBRA" | "EQUIPO" | "SUBCONTRATO" = "MATERIAL";
    if (tipoRaw.includes("MANO") || tipoRaw === "MO" || tipoRaw === "MANO_DE_OBRA") {
      tipo = "MANO_DE_OBRA";
    } else if (tipoRaw.includes("EQUIPO") || tipoRaw === "EQ") {
      tipo = "EQUIPO";
    } else if (tipoRaw.includes("SUB") || tipoRaw === "SUBCONTRATO") {
      tipo = "SUBCONTRATO";
    }

    const insumoCodigo = safeStr(getField(row, ["insumo", "código insumo", "cod insumo", "codInsumo"], 2));
    if (!insumoCodigo) return;

    result.push({
      partidaCodigo,
      tipo,
      insumoCodigo,
      cantidadPorUnidad: safeNum(getField(row, ["cantidad", "cant", "cantidadporunidad"], 3)),
      pctDesperdicio: safeNum(getField(row, ["desperdicio", "pct", "%desp", "desperdi"], 4)),
      secuencia: Math.round(safeNum(getField(row, ["secuencia", "seq", "orden", "nro"], 5))),
    });
  });
  return result;
}

export function parseAPUExcel(buffer: Buffer): { data: ParsedAPU | null; errors: ParseError[] } {
  const errors: ParseError[] = [];
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer" });
  } catch {
    return { data: null, errors: [{ sheet: "FILE", message: "No se pudo leer el archivo .xlsx" }] };
  }

  const sheetNames = workbook.SheetNames.map((s) => s.toUpperCase());
  const missing = REQUIRED_SHEETS.filter((s) => !sheetNames.includes(s.toUpperCase()));
  if (missing.length > 0) {
    missing.forEach((s) => errors.push({ sheet: s, message: `Hoja "${s}" no encontrada` }));
    return { data: null, errors };
  }

  const getSheet = (name: string): XLSX.WorkSheet => {
    const key = workbook.SheetNames.find((s) => s.toUpperCase() === name.toUpperCase())!;
    return workbook.Sheets[key];
  };

  const materiales = parseMateriales(getSheet("MATERIALES"), errors);
  const manosDeObra = parseManoDeObra(getSheet("MANO_DE_OBRA"), errors);
  const equipos = parseEquipos(getSheet("EQUIPOS"), errors);
  const partidas = parsePartidas(getSheet("PARTIDAS"), errors);
  const composiciones = parseComposicion(getSheet("COMPOSICIÓN"), errors);

  const subPRYKey = workbook.SheetNames.find((s) => s.toUpperCase() === "SUBCONTRATOS_PRY");
  const subcontratosPRY = subPRYKey ? parseSubcontratosPRY(workbook.Sheets[subPRYKey], errors) : [];

  const subKey = workbook.SheetNames.find((s) => s.toUpperCase() === "SUBCONTRATOS");
  const subcontratos = subKey ? parseSubcontratos(workbook.Sheets[subKey], errors) : [];

  return {
    data: {
      insumos: [...materiales, ...manosDeObra, ...equipos, ...subcontratosPRY, ...subcontratos],
      partidas,
      composiciones,
    },
    errors,
  };
}

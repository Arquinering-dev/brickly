import * as XLSX from "xlsx";

export interface ConfigData {
  mesBaseCAC: string;
  cacBase: number;
  coefCargasMO: number;
  ggPercent: number;
  bbPercent: number;
}

export interface MaterialRow {
  codigo: string;
  descripcion: string;
  unidad: string;
  precio: number;
  proveedor?: string;
  categoria?: string;
}

export interface ManoDeObraRow {
  codigo: string;
  descripcion: string;
  salarioDia: number;
  coefCargas: number;
  tipo: string;
}

export interface EquipoRow {
  codigo: string;
  descripcion: string;
  costoTotal: number;
  vidaDias: number;
  costoDia: number;
}

export interface PartidaRow {
  codigo: string;
  rubro: string;
  descripcion: string;
  unidad: string;
  rendimiento: number;
  pctDesperdicioConsumibles: number;
  pctDesperdicioGeneral: number;
  gradoDificultad: number;
  matUnitario: number;
  moUnitario: number;
  eqUnitario: number;
  cdUnitario: number;
}

export interface ComposicionRow {
  partidaCodigo: string;
  tipo: "MATERIAL" | "MANO_DE_OBRA" | "EQUIPO";
  insumoCodigo: string;
  cantidadPorUnidad: number;
  pctDesperdicio: number;
  secuencia: number;
}

export interface PresupuestoLineaRow {
  codigoPartida: string;
  cantidad: number;
  matTotal: number;
  moTotal: number;
  eqTotal: number;
}

export interface ParsedAPU {
  config: ConfigData;
  materiales: MaterialRow[];
  manosDeObra: ManoDeObraRow[];
  equipos: EquipoRow[];
  partidas: PartidaRow[];
  composiciones: ComposicionRow[];
  presupuestoLineas: PresupuestoLineaRow[];
}

export interface ParseError {
  sheet: string;
  row?: number;
  field?: string;
  message: string;
}

const REQUIRED_SHEETS = [
  "CONFIG",
  "MATERIALES",
  "MANO_DE_OBRA",
  "EQUIPOS",
  "PARTIDAS",
  "COMPOSICIÓN",
  "PPTO_APROBADO",
];

function safeStr(val: unknown, fallback = ""): string {
  if (val === null || val === undefined) return fallback;
  return String(val).trim();
}

function safeNum(val: unknown, fallback = 0): number {
  if (val === null || val === undefined || val === "") return fallback;
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

function safeInt(val: unknown, fallback = 0): number {
  return Math.round(safeNum(val, fallback));
}

function sheetToRows(sheet: XLSX.WorkSheet): Record<string, unknown>[] {
  return XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });
}

function findConfigValue(
  rows: Record<string, unknown>[],
  keys: string[]
): string | null {
  for (const row of rows) {
    const vals = Object.values(row).map((v) => safeStr(v).toUpperCase());
    for (const key of keys) {
      const idx = vals.indexOf(key.toUpperCase());
      if (idx !== -1) {
        const allVals = Object.values(row);
        const nextVal = allVals[idx + 1];
        if (nextVal !== null && nextVal !== undefined) {
          return safeStr(nextVal);
        }
      }
    }
  }
  return null;
}

function parseConfig(
  sheet: XLSX.WorkSheet,
  errors: ParseError[]
): ConfigData | null {
  const rows = sheetToRows(sheet);

  const cacBaseRaw = findConfigValue(rows, ["CAC_BASE", "CAC BASE"]);
  const coefRaw = findConfigValue(rows, ["COEF_CARGAS_MO", "COEF CARGAS MO"]);
  const ggRaw = findConfigValue(rows, ["GG"]);
  const bbRaw = findConfigValue(rows, ["BB"]);
  const mesRaw = findConfigValue(rows, ["MES_BASE_CAC", "MES BASE CAC", "MES"]);

  if (!cacBaseRaw) {
    errors.push({ sheet: "CONFIG", message: "No se encontró CAC_BASE" });
  }

  return {
    mesBaseCAC: mesRaw ?? "",
    cacBase: cacBaseRaw ? parseFloat(cacBaseRaw) : 0,
    coefCargasMO: coefRaw ? parseFloat(coefRaw) : 0,
    ggPercent: ggRaw ? parseFloat(ggRaw) : 0,
    bbPercent: bbRaw ? parseFloat(bbRaw) : 0,
  };
}

function parseMateriales(
  sheet: XLSX.WorkSheet,
  errors: ParseError[]
): MaterialRow[] {
  const rows = sheetToRows(sheet);
  const result: MaterialRow[] = [];

  rows.forEach((row, i) => {
    const vals = Object.values(row);
    const keys = Object.keys(row);

    // Try header-based lookup first, then positional fallback
    const get = (names: string[], pos: number): unknown => {
      for (const name of names) {
        const idx = keys.findIndex(
          (k) => k.toLowerCase().includes(name.toLowerCase())
        );
        if (idx !== -1) return vals[idx];
      }
      return vals[pos] ?? null;
    };

    const codigo = safeStr(get(["código", "codigo", "code"], 0));
    if (!codigo) return; // skip empty rows

    const precio = safeNum(get(["precio", "price"], 3));
    if (isNaN(precio)) {
      errors.push({
        sheet: "MATERIALES",
        row: i + 2,
        field: "precio",
        message: `Precio inválido en fila ${i + 2}, código ${codigo}`,
      });
    }

    result.push({
      codigo,
      descripcion: safeStr(get(["descripción", "descripcion", "desc"], 1)),
      unidad: safeStr(get(["unidad", "ud", "unit"], 2)),
      precio,
      proveedor: safeStr(get(["proveedor", "prov"], 4)) || undefined,
      categoria: safeStr(get(["categoría", "categoria", "cat"], 5)) || undefined,
    });
  });

  return result;
}

function parseManoDeObra(
  sheet: XLSX.WorkSheet,
  errors: ParseError[]
): ManoDeObraRow[] {
  const rows = sheetToRows(sheet);
  const result: ManoDeObraRow[] = [];

  rows.forEach((row, i) => {
    const vals = Object.values(row);
    const keys = Object.keys(row);

    const get = (names: string[], pos: number): unknown => {
      for (const name of names) {
        const idx = keys.findIndex(
          (k) => k.toLowerCase().includes(name.toLowerCase())
        );
        if (idx !== -1) return vals[idx];
      }
      return vals[pos] ?? null;
    };

    const codigo = safeStr(get(["código", "codigo"], 0));
    if (!codigo) return;

    result.push({
      codigo,
      descripcion: safeStr(get(["descripción", "descripcion"], 1)),
      salarioDia: safeNum(get(["salario", "sueldo"], 2)),
      coefCargas: safeNum(get(["coef", "coeficiente"], 3), 1),
      tipo: safeStr(get(["tipo", "type"], 4)) || "OFICIAL",
    });
  });

  return result;
}

function parseEquipos(
  sheet: XLSX.WorkSheet,
  errors: ParseError[]
): EquipoRow[] {
  const rows = sheetToRows(sheet);
  const result: EquipoRow[] = [];

  rows.forEach((row, i) => {
    const vals = Object.values(row);
    const keys = Object.keys(row);

    const get = (names: string[], pos: number): unknown => {
      for (const name of names) {
        const idx = keys.findIndex(
          (k) => k.toLowerCase().includes(name.toLowerCase())
        );
        if (idx !== -1) return vals[idx];
      }
      return vals[pos] ?? null;
    };

    const codigo = safeStr(get(["código", "codigo"], 0));
    if (!codigo) return;

    result.push({
      codigo,
      descripcion: safeStr(get(["descripción", "descripcion"], 1)),
      costoTotal: safeNum(get(["costo total", "costototal"], 2)),
      vidaDias: safeInt(get(["vida", "días", "dias"], 3)),
      costoDia: safeNum(get(["costo/día", "costo/dia", "costodía"], 4)),
    });
  });

  return result;
}

function parsePartidas(
  sheet: XLSX.WorkSheet,
  errors: ParseError[]
): PartidaRow[] {
  const rows = sheetToRows(sheet);
  const result: PartidaRow[] = [];

  rows.forEach((row, i) => {
    const vals = Object.values(row);
    const keys = Object.keys(row);

    const get = (names: string[], pos: number): unknown => {
      for (const name of names) {
        const idx = keys.findIndex(
          (k) => k.toLowerCase().includes(name.toLowerCase())
        );
        if (idx !== -1) return vals[idx];
      }
      return vals[pos] ?? null;
    };

    const codigo = safeStr(get(["código", "codigo"], 0));
    if (!codigo) return;

    result.push({
      codigo,
      rubro: safeStr(get(["rubro"], 1)),
      descripcion: safeStr(get(["descripción", "descripcion"], 2)),
      unidad: safeStr(get(["unidad"], 3)),
      rendimiento: safeNum(get(["rendimiento"], 4), 1),
      pctDesperdicioConsumibles: safeNum(get(["consumibles", "desperdicios consumibles"], 5)),
      pctDesperdicioGeneral: safeNum(get(["general", "desperdicio general"], 6)),
      gradoDificultad: safeInt(get(["grado", "dificultad"], 7), 1),
      matUnitario: safeNum(get(["mat unitario", "material"], 8)),
      moUnitario: safeNum(get(["mo unitario", "mano"], 9)),
      eqUnitario: safeNum(get(["eq unitario", "equipo"], 10)),
      cdUnitario: safeNum(get(["cd unitario", "costo directo"], 11)),
    });
  });

  return result;
}

function parseComposicion(
  sheet: XLSX.WorkSheet,
  errors: ParseError[]
): ComposicionRow[] {
  const rows = sheetToRows(sheet);
  const result: ComposicionRow[] = [];

  rows.forEach((row, i) => {
    const vals = Object.values(row);
    const keys = Object.keys(row);

    const get = (names: string[], pos: number): unknown => {
      for (const name of names) {
        const idx = keys.findIndex(
          (k) => k.toLowerCase().includes(name.toLowerCase())
        );
        if (idx !== -1) return vals[idx];
      }
      return vals[pos] ?? null;
    };

    const partidaCodigo = safeStr(get(["partida", "código partida", "cod partida"], 0));
    if (!partidaCodigo) return;

    const tipoRaw = safeStr(get(["tipo"], 1)).toUpperCase();
    let tipo: "MATERIAL" | "MANO_DE_OBRA" | "EQUIPO" = "MATERIAL";
    if (tipoRaw.includes("MANO") || tipoRaw === "MO" || tipoRaw === "MANO_DE_OBRA") {
      tipo = "MANO_DE_OBRA";
    } else if (tipoRaw.includes("EQUIPO") || tipoRaw === "EQ") {
      tipo = "EQUIPO";
    }

    const insumoCodigo = safeStr(get(["insumo", "código insumo", "cod insumo"], 2));
    if (!insumoCodigo) return;

    result.push({
      partidaCodigo,
      tipo,
      insumoCodigo,
      cantidadPorUnidad: safeNum(get(["cantidad", "cant"], 3), 0),
      pctDesperdicio: safeNum(get(["desperdicio", "pct", "%"], 4)),
      secuencia: safeInt(get(["secuencia", "seq", "orden"], 5)),
    });
  });

  return result;
}

function parsePresupuesto(
  sheet: XLSX.WorkSheet,
  errors: ParseError[]
): PresupuestoLineaRow[] {
  const rows = sheetToRows(sheet);
  const result: PresupuestoLineaRow[] = [];

  rows.forEach((row, i) => {
    const vals = Object.values(row);
    const keys = Object.keys(row);

    const get = (names: string[], pos: number): unknown => {
      for (const name of names) {
        const idx = keys.findIndex(
          (k) => k.toLowerCase().includes(name.toLowerCase())
        );
        if (idx !== -1) return vals[idx];
      }
      return vals[pos] ?? null;
    };

    const codigoPartida = safeStr(get(["código", "codigo", "partida"], 0));
    if (!codigoPartida) return;

    result.push({
      codigoPartida,
      cantidad: safeNum(get(["cantidad", "cant"], 1)),
      matTotal: safeNum(get(["mat total", "mat"], 2)),
      moTotal: safeNum(get(["mo total", "mo"], 3)),
      eqTotal: safeNum(get(["eq total", "eq"], 4)),
    });
  });

  return result;
}

export function parseAPUExcel(buffer: Buffer): {
  data: ParsedAPU | null;
  errors: ParseError[];
} {
  const errors: ParseError[] = [];

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer" });
  } catch {
    return {
      data: null,
      errors: [{ sheet: "FILE", message: "No se pudo leer el archivo .xlsx" }],
    };
  }

  const sheetNames = workbook.SheetNames.map((s) => s.toUpperCase());
  const missing = REQUIRED_SHEETS.filter(
    (s) => !sheetNames.includes(s.toUpperCase())
  );
  if (missing.length > 0) {
    missing.forEach((s) =>
      errors.push({ sheet: s, message: `Hoja "${s}" no encontrada` })
    );
    return { data: null, errors };
  }

  const getSheet = (name: string): XLSX.WorkSheet => {
    const key = workbook.SheetNames.find(
      (s) => s.toUpperCase() === name.toUpperCase()
    )!;
    return workbook.Sheets[key];
  };

  const config = parseConfig(getSheet("CONFIG"), errors);
  const materiales = parseMateriales(getSheet("MATERIALES"), errors);
  const manosDeObra = parseManoDeObra(getSheet("MANO_DE_OBRA"), errors);
  const equipos = parseEquipos(getSheet("EQUIPOS"), errors);
  const partidas = parsePartidas(getSheet("PARTIDAS"), errors);
  const composiciones = parseComposicion(getSheet("COMPOSICIÓN"), errors);
  const presupuestoLineas = parsePresupuesto(getSheet("PPTO_APROBADO"), errors);

  if (!config) {
    return { data: null, errors };
  }

  return {
    data: {
      config,
      materiales,
      manosDeObra,
      equipos,
      partidas,
      composiciones,
      presupuestoLineas,
    },
    errors,
  };
}

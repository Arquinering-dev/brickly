/**
 * Parser para el Excel "Resumen de Obra" (formato Arquinering).
 * Lee cada hoja y retorna un objeto ParsedResumen tipado.
 * Es robusto: si una hoja falta, retorna array vacío con un warning.
 */
import * as XLSX from "xlsx";

// ---------------------------------------------------------------------------
// Tipos exportados
// ---------------------------------------------------------------------------

export interface ParsedResumen {
  config: {
    coefGGBB: number | null;
    mesCacBase: string | null;
    valorCacBase: number | null;
    costoControlable: number | null;
    precioVentaTotal: number | null;
    aperturaBlancoP: number | null;
    aperturaNegrop: number | null;
    centroCosto: string | null;
  };
  rubros: Array<{ nombre: string; codigo: string }>;
  indicesCAC: Array<{ mes: Date; valorIndec: number; esPrevision: boolean; ratio: number | null }>;
  tarifasUOCRA: Array<{ mes: Date; categoria: string; precioDia: number }>;
  lineasPresupuesto: Array<{
    itemNumero: string;
    descripcion: string;
    unidad: string;
    cantidad: number;
    rubro: string;
    etapa: string | null;
    estadoItem: string;
    orden: number;
    costoMtUd: number;
    costoMoOtrUd: number;
    costoMoAlbUd: number;
    costoEqUd: number;
    costoUnitTotal: number;
    pvUd: number;
    pvMtUd: number;
    pvMoOtrUd: number;
    pvMoAlbUd: number;
    pvEqUd: number;
    pctCertificado: number;
    rubroMt: string | null;
    rubroMoOtr: string | null;
    rubroMoAlb: string | null;
  }>;
  movimientos: Array<{
    cuentaCodigo: string;
    cuentaNombre: string | null;
    fecha: Date;
    nroAsiento: number | null;
    observaciones: string | null;
    proveedor: string | null;
    codComprobante: string | null;
    nroComprobante: string | null;
    debe: number;
    haber: number;
    centroCosto: string | null;
    subcontratoId: string | null;
    movTipo: string | null;
  }>;
  subcontratos: Array<{
    contratoId: string;
    proveedor: string;
    rubro: string;
    descripcion: string | null;
    montoPpto: number;
    ajustaCAC: boolean;
    pctAnticipo: number | null;
    pagadoBase: number;
    pagadoCAC: number;
    pagadoCS: number;
    pagadoTotal: number;
    saldo: number;
    pctConsumido: number | null;
    estado: string;
  }>;
  quincenas: Array<{
    mes: Date;
    periodo: string;
    categoria: string;
    rubro: string;
    horasNormales: number;
    horasExtra50: number;
    horasExtra100: number;
    costoTotal: number;
    costoDeflactado: number;
  }>;
  gastosDirInd: Array<{
    fecha: Date;
    tipo: string;
    concepto: string;
    monto: number;
  }>;
  contratos: Array<{
    ocId: string;
    descripcion: string | null;
    presupuestoAprobado: number;
    pctAnticipo: number;
    mesCacBase: string | null;
    indiceCACBase: number | null;
    pctBlanco: number;
    pctNegro: number;
    pctDesacopio: number;
    pctIVA: number;
    presupuestoLabel: string | null;
  }>;
  certificaciones: Array<{
    certId: string;
    ocId: string;
    fecha: Date;
    baseBruta: number;
    pctDesacopio: number;
    desacopio: number;
    subtotalNeto: number;
  }>;
  lineasCert: Array<{
    certId: string;
    ocId: string;
    codTarea: string;
    pctAnterior: number;
    pctActual: number;
    pctTotal: number;
    pvTotalTarea: number;
    baseCertificada: number;
    presupuestoLabel: string | null;
  }>;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function excelDateToJS(serial: number): Date {
  const excelEpoch = new Date(1899, 11, 30);
  return new Date(excelEpoch.getTime() + serial * 86400000);
}

function parseDate(v: unknown): Date | null {
  if (v instanceof Date) return v;
  if (typeof v === "number" && v > 40000) return excelDateToJS(v);
  if (typeof v === "string") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function safeNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return isNaN(n) ? fallback : n;
}

function safeStr(v: unknown, fallback = ""): string {
  if (v === null || v === undefined) return fallback;
  return String(v).trim();
}

function normalizePct(v: unknown, warnings?: string[], label?: string): number {
  const n = safeNum(v, 0);
  // If stored as fraction (0.xx) leave as-is; if > 1 it's already a percentage (e.g. 21 → 0.21)
  const pct = n > 1 ? n / 100 : n;
  // Hard clamp to [0, 9.99] so the value always fits in Decimal(5,2) — values >> 1 indicate
  // a column mismatch (a monetary amount read as a percentage field); warn and zero it out.
  if (pct > 9.99 || pct < 0) {
    if (warnings && label) warnings.push(`${label}: valor de porcentaje fuera de rango (raw=${n}, norm=${pct.toFixed(4)}) — se usará 0`);
    return 0;
  }
  return pct;
}

function emojiToEstado(v: unknown): string {
  const s = safeStr(v);
  if (s.includes("🟢")) return "activo";
  if (s.includes("🟠")) return "alerta";
  if (s.includes("🔴")) return "critico";
  // Also handle text values
  const lower = s.toLowerCase();
  if (lower === "activo" || lower === "active") return "activo";
  if (lower === "alerta" || lower === "warning") return "alerta";
  if (lower === "critico" || lower === "critical") return "critico";
  return "activo";
}

function getSheetRows(
  wb: XLSX.WorkBook,
  sheetName: string,
  warnings: string[]
): unknown[][] {
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    warnings.push(`Hoja "${sheetName}" no encontrada en el Excel`);
    return [];
  }
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
}

function isSection(row: unknown[]): boolean {
  const f = row[5];
  if (f === null || f === undefined || f === "") return false;
  const n = Number(f);
  if (isNaN(n)) return false;
  return Number.isInteger(n) && !String(f).includes(".");
}

// ---------------------------------------------------------------------------
// Parsers por hoja
// ---------------------------------------------------------------------------

function parseListas(wb: XLSX.WorkBook, warnings: string[]): ParsedResumen["rubros"] {
  const rows = getSheetRows(wb, "_Listas", warnings);
  const rubros: ParsedResumen["rubros"] = [];
  // fila 0 = header, datos desde fila 1
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const nombre = safeStr(row[0]);
    const codigoRaw = safeStr(row[1]);
    if (!nombre || !codigoRaw) continue;
    // Solo filas donde col B sea número de 5+ dígitos (53xxx, 52xxx)
    if (!/^\d{5,}$/.test(codigoRaw)) continue;
    rubros.push({ nombre, codigo: codigoRaw });
  }
  return rubros;
}

function parseConfig(wb: XLSX.WorkBook, warnings: string[]): ParsedResumen["config"] {
  const config: ParsedResumen["config"] = {
    coefGGBB: null,
    mesCacBase: null,
    valorCacBase: null,
    costoControlable: null,
    precioVentaTotal: null,
    aperturaBlancoP: null,
    aperturaNegrop: null,
    centroCosto: null,
  };

  const rows = getSheetRows(wb, "0_CONFIG", warnings);
  if (rows.length === 0) return config;

  for (const row of rows) {
    for (let i = 0; i < row.length - 1; i++) {
      const cell = safeStr(row[i]).toLowerCase();
      if (!cell) continue;

      const nextVal = row[i + 1];
      const nextVal2 = i + 2 < row.length ? row[i + 2] : null;

      if (cell === "k" || (cell.includes("coef") && cell.includes("k"))) {
        const v = safeNum(nextVal, 0) || safeNum(nextVal2, 0);
        if (v !== 0) config.coefGGBB = v;
      } else if (cell === "cac base" || cell === "cac_base" || cell.includes("cac base") || cell.includes("cac_base")) {
        const v = safeNum(nextVal, 0) || safeNum(nextVal2, 0);
        if (v !== 0) config.valorCacBase = v;
      } else if (cell === "mes" || cell.includes("mes base cac")) {
        const s = safeStr(nextVal) || safeStr(nextVal2);
        if (s) config.mesCacBase = s;
      } else if (cell.includes("costo controlable")) {
        const v = safeNum(nextVal, 0) || safeNum(nextVal2, 0);
        if (v !== 0) config.costoControlable = v;
      } else if (cell.includes("precio de venta") || cell.includes("p. de venta") || cell.includes("p.de venta")) {
        const v = safeNum(nextVal, 0) || safeNum(nextVal2, 0);
        if (v !== 0) config.precioVentaTotal = v;
      } else if (cell.includes("% blanco") || cell === "blanco") {
        const v = safeNum(nextVal, 0) || safeNum(nextVal2, 0);
        if (v !== 0) config.aperturaBlancoP = v;
      } else if (cell.includes("% negro") || cell === "negro") {
        const v = safeNum(nextVal, 0) || safeNum(nextVal2, 0);
        if (v !== 0) config.aperturaNegrop = v;
      } else if (cell.includes("centro de costo") || cell.includes("código") || cell === "codigo") {
        const s = safeStr(nextVal) || safeStr(nextVal2);
        if (s) config.centroCosto = s;
      }
    }
  }

  return config;
}

function parseIndicesCAC(wb: XLSX.WorkBook, warnings: string[]): ParsedResumen["indicesCAC"] {
  const rows = getSheetRows(wb, "0_Indice_CAC", warnings);
  const result: ParsedResumen["indicesCAC"] = [];
  // fila 0 = header
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const fecha = parseDate(row[0]);
    if (!fecha) continue;
    const valorIndec = safeNum(row[1], 0);
    if (valorIndec === 0) continue;
    const esPrevisionRaw = safeStr(row[2]).toUpperCase();
    const esPrevision = esPrevisionRaw === "SI" || esPrevisionRaw === "TRUE" || esPrevisionRaw === "1";
    const ratioRaw = row[3];
    const ratio = ratioRaw !== null && ratioRaw !== undefined && safeNum(ratioRaw, 0) !== 0
      ? safeNum(ratioRaw)
      : null;
    // Normalizar al primer día del mes UTC
    const mes = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), 1));
    result.push({ mes, valorIndec, esPrevision, ratio });
  }
  return result;
}

function parseTarifasUOCRA(wb: XLSX.WorkBook, warnings: string[]): ParsedResumen["tarifasUOCRA"] {
  const rows = getSheetRows(wb, "0_Jornales_MO", warnings);
  const result: ParsedResumen["tarifasUOCRA"] = [];
  if (rows.length < 2) return result;

  // fila 0 = headers: col 0 = mes, col 1+ = categorías
  const headers = rows[0] as unknown[];
  const categorias: string[] = [];
  for (let c = 1; c < headers.length; c++) {
    const h = safeStr(headers[c]);
    if (h) categorias.push(h);
  }

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const fecha = parseDate(row[0]);
    if (!fecha) continue;
    const mes = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), 1));
    for (let c = 0; c < categorias.length; c++) {
      const precioDia = safeNum(row[c + 1], 0);
      if (precioDia === 0) continue;
      result.push({ mes, categoria: categorias[c], precioDia });
    }
  }
  return result;
}

function parsePresupuesto(wb: XLSX.WorkBook, warnings: string[]): ParsedResumen["lineasPresupuesto"] {
  const rows = getSheetRows(wb, "1_Presupuesto", warnings);
  const result: ParsedResumen["lineasPresupuesto"] = [];
  if (rows.length < 4) return result;

  // headers en fila 3 (index 2), datos desde fila 4 (index 3)
  let seccionActual = "";
  let orden = 0;

  for (let i = 3; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => c === null || c === undefined || c === "")) continue;

    // col F (index 5): número de ítem
    const colF = row[5];
    if (colF === null || colF === undefined) continue;

    // Detectar fila de sección: col F es entero y col G es null
    if (isSection(row)) {
      const desc = safeStr(row[7]); // col H = descripción
      if (desc) seccionActual = desc;
      continue;
    }

    // Fila de ítem: col F tiene punto decimal (1.01, 2.03...)
    const fStr = String(colF).trim();
    if (!fStr.includes(".") && !/^\d+\.\d+$/.test(fStr)) {
      // Not a decimal item number — skip
      continue;
    }

    // col G (index 6): estado — ignorar "IN"
    const estadoItem = safeStr(row[6]) || "OK";
    if (estadoItem.toUpperCase() === "IN") continue;

    try {
      const itemNumero = fStr;
      const descripcion = safeStr(row[7]);   // col H
      const unidad = safeStr(row[8]);          // col I
      const cantidad = safeNum(row[9], 0);     // col J
      const costoMtUd = safeNum(row[10], 0);   // col K
      const costoMoOtrUd = safeNum(row[11], 0);// col L
      const costoMoAlbUd = safeNum(row[12], 0);// col M
      const costoEqUd = safeNum(row[13], 0);   // col N
      const costoUnitTotal = safeNum(row[14], 0); // col O
      const pvUd = safeNum(row[15], 0);        // col P
      // col Q = index 16 (skip)
      const pvMtUd = safeNum(row[17], 0);      // col R
      const pvMoOtrUd = safeNum(row[18], 0);   // col S
      const pvMoAlbUd = safeNum(row[19], 0);   // col T
      const pvEqUd = safeNum(row[20], 0);      // col U
      // cols V-AA = indices 21-26 (skip)
      const etapa = safeStr(row[27]) || null;   // col AB (index 27)
      const pctAnterior = safeNum(row[28], 0);  // col AC (index 28)
      const pctActual = safeNum(row[29], 0);    // col AD (index 29)
      const pctCertificado = safeNum(row[30], 0); // col AE (index 30)

      // cols A-D: rubros por componente
      const rubroMt = safeStr(row[0]) || null;    // col A
      // col B = rubro MT/Prov (skip for now, same as rubroMt)
      const rubroMoOtr = safeStr(row[2]) || null; // col C
      const rubroMoAlb = safeStr(row[3]) || null; // col D

      result.push({
        itemNumero,
        descripcion,
        unidad,
        cantidad,
        rubro: seccionActual,
        etapa: etapa || null,
        estadoItem: estadoItem || "OK",
        orden: orden++,
        costoMtUd,
        costoMoOtrUd,
        costoMoAlbUd,
        costoEqUd,
        costoUnitTotal,
        pvUd,
        pvMtUd,
        pvMoOtrUd,
        pvMoAlbUd,
        pvEqUd,
        pctCertificado,
        rubroMt,
        rubroMoOtr,
        rubroMoAlb,
      });
    } catch (err) {
      warnings.push(`1_Presupuesto fila ${i + 1}: error al parsear — ${err}`);
    }
  }
  return result;
}

function parseMovimientos(wb: XLSX.WorkBook, warnings: string[]): ParsedResumen["movimientos"] {
  const rows = getSheetRows(wb, "2_Movimientos", warnings);
  const result: ParsedResumen["movimientos"] = [];
  // fila 0 = header
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const cuentaCodigoRaw = row[0];
    if (cuentaCodigoRaw === null || cuentaCodigoRaw === undefined || cuentaCodigoRaw === "") continue;
    const cuentaCodigo = safeStr(cuentaCodigoRaw);
    // Solo códigos numéricos de 5+ dígitos
    if (!/^\d{5,}$/.test(cuentaCodigo)) continue;

    const fecha = parseDate(row[2]);
    if (!fecha) {
      warnings.push(`2_Movimientos fila ${i + 1}: fecha inválida, fila ignorada`);
      continue;
    }

    try {
      const subcontratoIdRaw = safeStr(row[16]) || null;
      result.push({
        cuentaCodigo,
        cuentaNombre: safeStr(row[1]) || null,
        fecha,
        nroAsiento: row[3] !== null && row[3] !== undefined ? safeNum(row[3]) || null : null,
        observaciones: safeStr(row[4]) || null,
        proveedor: safeStr(row[5]) || null,
        codComprobante: safeStr(row[6]) || null,
        nroComprobante: row[7] !== null && row[7] !== undefined ? safeStr(row[7]) || null : null,
        debe: safeNum(row[8], 0),
        haber: safeNum(row[9], 0),
        centroCosto: safeStr(row[10]) || null,
        subcontratoId: subcontratoIdRaw || null,
        movTipo: safeStr(row[17]) || null,
      });
    } catch (err) {
      warnings.push(`2_Movimientos fila ${i + 1}: error al parsear — ${err}`);
    }
  }
  return result;
}

function parseSubcontratos(wb: XLSX.WorkBook, warnings: string[]): ParsedResumen["subcontratos"] {
  const rows = getSheetRows(wb, "2_Subcontratos", warnings);
  const result: ParsedResumen["subcontratos"] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const contratoId = safeStr(row[0]);
    if (!contratoId) continue;

    try {
      const ajustaCACRaw = row[5];
      let ajustaCAC = false;
      if (typeof ajustaCACRaw === "boolean") {
        ajustaCAC = ajustaCACRaw;
      } else {
        ajustaCAC = safeStr(ajustaCACRaw).toUpperCase() === "SI";
      }

      const pctConsumidoRaw = row[12];
      const pctConsumido = pctConsumidoRaw !== null && pctConsumidoRaw !== undefined
        ? safeNum(pctConsumidoRaw)
        : null;

      const pctAnticipoRaw = row[6];
      const pctAnticipo = pctAnticipoRaw !== null && pctAnticipoRaw !== undefined
        ? normalizePct(pctAnticipoRaw)
        : null;

      result.push({
        contratoId,
        proveedor: safeStr(row[1]),
        rubro: safeStr(row[2]),
        descripcion: safeStr(row[3]) || null,
        montoPpto: safeNum(row[4], 0),
        ajustaCAC,
        pctAnticipo,
        pagadoBase: safeNum(row[7], 0),
        pagadoCAC: safeNum(row[8], 0),
        pagadoCS: safeNum(row[9], 0),
        pagadoTotal: safeNum(row[10], 0),
        saldo: safeNum(row[11], 0),
        pctConsumido,
        estado: emojiToEstado(row[13]),
      });
    } catch (err) {
      warnings.push(`2_Subcontratos fila ${i + 1}: error al parsear — ${err}`);
    }
  }
  return result;
}

function parseQuincenas(wb: XLSX.WorkBook, warnings: string[]): ParsedResumen["quincenas"] {
  const rows = getSheetRows(wb, "2_Quincenas", warnings);
  const result: ParsedResumen["quincenas"] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const fecha = parseDate(row[0]);
    if (!fecha) continue;
    const periodo = safeStr(row[1]);
    if (!periodo) continue;

    try {
      const mes = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), 1));
      result.push({
        mes,
        periodo,
        categoria: safeStr(row[3]),
        rubro: safeStr(row[4]),
        horasNormales: safeNum(row[5], 0),
        horasExtra50: safeNum(row[6], 0),
        horasExtra100: safeNum(row[7], 0),
        costoTotal: safeNum(row[10], 0),
        costoDeflactado: safeNum(row[14], 0),
      });
    } catch (err) {
      warnings.push(`2_Quincenas fila ${i + 1}: error al parsear — ${err}`);
    }
  }
  return result;
}

function parseGastosDirInd(wb: XLSX.WorkBook, warnings: string[]): ParsedResumen["gastosDirInd"] {
  const rows = getSheetRows(wb, "2_Gastos_DirInd", warnings);
  const result: ParsedResumen["gastosDirInd"] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const fecha = parseDate(row[0]);
    if (!fecha) continue;
    const concepto = safeStr(row[2]);
    if (!concepto) continue;

    try {
      result.push({
        fecha,
        tipo: safeStr(row[1]) || "Directo",
        concepto,
        monto: safeNum(row[3], 0),
      });
    } catch (err) {
      warnings.push(`2_Gastos_DirInd fila ${i + 1}: error al parsear — ${err}`);
    }
  }
  return result;
}

function parseContratos(wb: XLSX.WorkBook, warnings: string[]): ParsedResumen["contratos"] {
  const rows = getSheetRows(wb, "Cert_OC_Cliente", warnings);
  const result: ParsedResumen["contratos"] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    // Col 0: Obra (nombre), Col 1: ID OC, Col 2: Descripcion, Col 3: Presupuesto aprobado,
    // Col 4: % anticipo, Col 5: Mes base CAC, Col 6: Indice base CAC,
    // Col 7: % Blanco, Col 8: % Negro, Col 9: % desacopio, Col 10: % IVA, Col 11: Presupuesto label
    const ocId = safeStr(row[1]);
    if (!ocId) continue;

    try {
      const ctx = `Cert_OC_Cliente fila ${i + 1} (OC=${ocId})`;
      result.push({
        ocId,
        descripcion: safeStr(row[2]) || null,
        presupuestoAprobado: safeNum(row[3], 0),
        pctAnticipo: normalizePct(row[4], warnings, `${ctx} pctAnticipo`),
        mesCacBase: safeStr(row[5]) || null,
        indiceCACBase: row[6] !== null && row[6] !== undefined ? safeNum(row[6]) : null,
        pctBlanco: normalizePct(row[7], warnings, `${ctx} pctBlanco`),
        pctNegro: normalizePct(row[8], warnings, `${ctx} pctNegro`),
        pctDesacopio: normalizePct(row[9], warnings, `${ctx} pctDesacopio`),
        pctIVA: normalizePct(row[10], warnings, `${ctx} pctIVA`),
        presupuestoLabel: safeStr(row[11]) || null,
      });
    } catch (err) {
      warnings.push(`Cert_OC_Cliente fila ${i + 1}: error al parsear — ${err}`);
    }
  }
  return result;
}

function parseCertificaciones(wb: XLSX.WorkBook, warnings: string[]): ParsedResumen["certificaciones"] {
  const rows = getSheetRows(wb, "Cert_Cabecera", warnings);
  const result: ParsedResumen["certificaciones"] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const certId = safeStr(row[0]);
    const ocId = safeStr(row[1]);
    if (!certId || !ocId) continue;

    const fecha = parseDate(row[2]);
    if (!fecha) {
      warnings.push(`Cert_Cabecera fila ${i + 1}: fecha inválida, fila ignorada`);
      continue;
    }

    try {
      result.push({
        certId,
        ocId,
        fecha,
        baseBruta: safeNum(row[3], 0),
        pctDesacopio: normalizePct(row[4], warnings, `Cert_Cabecera fila ${i + 1} pctDesacopio`),
        desacopio: safeNum(row[5], 0),
        subtotalNeto: safeNum(row[6], 0),
      });
    } catch (err) {
      warnings.push(`Cert_Cabecera fila ${i + 1}: error al parsear — ${err}`);
    }
  }
  return result;
}

function parseLineasCert(wb: XLSX.WorkBook, warnings: string[]): ParsedResumen["lineasCert"] {
  const rows = getSheetRows(wb, "Cert_App_Output", warnings);
  const result: ParsedResumen["lineasCert"] = [];
  // Col 0: Obra, Col 1: ID OC, Col 2: ID Certif, Col 3: Fecha, Col 4: Cod. tarea,
  // Col 5: % anterior, Col 6: % actual, Col 7: % total,
  // Col 8: PV total tarea, Col 9: $ base tarea, Col 10: Presupuesto label
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const ocId = safeStr(row[1]);
    const certId = safeStr(row[2]);
    const codTarea = safeStr(row[4]);
    if (!certId || !codTarea) continue;

    try {
      result.push({
        certId,
        ocId,
        codTarea,
        pctAnterior: safeNum(row[5], 0),
        pctActual: safeNum(row[6], 0),
        pctTotal: safeNum(row[7], 0),
        pvTotalTarea: safeNum(row[8], 0),
        baseCertificada: safeNum(row[9], 0),
        presupuestoLabel: safeStr(row[10]) || null,
      });
    } catch (err) {
      warnings.push(`Cert_App_Output fila ${i + 1}: error al parsear — ${err}`);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Función principal
// ---------------------------------------------------------------------------

export function parseResumenObra(buffer: Buffer): ParsedResumen {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const warnings: string[] = [];

  const config = parseConfig(wb, warnings);
  const rubros = parseListas(wb, warnings);
  const indicesCAC = parseIndicesCAC(wb, warnings);
  const tarifasUOCRA = parseTarifasUOCRA(wb, warnings);
  const lineasPresupuesto = parsePresupuesto(wb, warnings);
  const movimientos = parseMovimientos(wb, warnings);
  const subcontratos = parseSubcontratos(wb, warnings);
  const quincenas = parseQuincenas(wb, warnings);
  const gastosDirInd = parseGastosDirInd(wb, warnings);
  const contratos = parseContratos(wb, warnings);
  const certificaciones = parseCertificaciones(wb, warnings);
  const lineasCert = parseLineasCert(wb, warnings);

  return {
    config,
    rubros,
    indicesCAC,
    tarifasUOCRA,
    lineasPresupuesto,
    movimientos,
    subcontratos,
    quincenas,
    gastosDirInd,
    contratos,
    certificaciones,
    lineasCert,
    warnings,
  };
}

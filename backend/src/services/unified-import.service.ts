import * as XLSX from "xlsx";
import prisma from "../prisma/client";
import { parseAPUExcel } from "./apu-parser.service";
import { importAPU } from "./apu-import.service";

export interface UnifiedImportSummary {
  insumos: number;
  partidas: number;
  composiciones: number;
  lineasPresupuesto: number;
  obraId: string;
  obraNombre: string;
  warnings: string[];
  errores: string[];
}

interface ConfigData {
  mesReferencia: string;
  anioReferencia: number;
  version: string;
  coefGGBB: number;
}

interface LinePPTO {
  orden: number;
  itemNumero: string;
  rubro: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  matUd: number;
  moUd: number;
  eqUd: number;
  cdUd: number;
  precioVenta: number | null;
  apuLinkCodigo: string | null;
  fuente: string | null;
}

function safeNum(val: unknown, fallback = 0): number {
  if (val === null || val === undefined || val === "") return fallback;
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

function safeStr(val: unknown, fallback = ""): string {
  if (val === null || val === undefined) return fallback;
  return String(val).trim();
}

function parseConfig(wb: XLSX.WorkBook): ConfigData {
  const ws = wb.Sheets["CONFIG"];
  if (!ws) return { mesReferencia: "", anioReferencia: 0, version: "", coefGGBB: 1 };

  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const config: Record<string, unknown> = {};
  for (const row of rows) {
    const key = safeStr((row as unknown[])[0]).toLowerCase();
    const val = (row as unknown[])[1];
    if (key.includes("mes")) config.mes = val;
    else if (key.includes("año") || key.includes("ano") || key.includes("year")) config.anio = val;
    else if (key.includes("versión") || key.includes("version")) config.version = val;
    else if (key.includes("gg") || key.includes("bb") || key.includes("coef")) {
      if (!config.gg) config.gg = val;
    }
  }
  return {
    mesReferencia: safeStr(config.mes),
    anioReferencia: safeNum(config.anio),
    version: safeStr(config.version),
    coefGGBB: 1,
  };
}

function parsePPTOGenerador(wb: XLSX.WorkBook): { titulo: string; coefGGBB: number; mesCac: string; lineas: LinePPTO[] } {
  const ws = wb.Sheets["PPTO_GENERADOR"];
  if (!ws) return { titulo: "", coefGGBB: 1, mesCac: "", lineas: [] };

  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  const titulo = safeStr(rows[0]?.[0] ?? "");
  const metaRow = rows[1] ?? [];
  const coefGGBB = safeNum(metaRow[13] ?? null, 1);
  const mesCac = safeStr(metaRow[7] ?? "");

  // Row index 2 is the header row (#, Rubro, Descripción, Ud., Cant., MAT/ud, MO/ud, EQ/ud, CD/ud, ...)
  // Data starts at row index 3
  const lineas: LinePPTO[] = [];
  let orden = 0;

  for (let i = 3; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0]) continue;

    const itemNum = row[0];
    const cant = safeNum(row[4] ?? null, -1);

    // Section header: integer item number and no Cant (null/undefined)
    // e.g.: (1, None, 'TAREAS PRELIMINARES', ...)
    if (Number.isInteger(itemNum) && (row[4] === null || row[4] === undefined)) continue;

    const desc = safeStr(row[2]);
    if (!desc) continue;

    lineas.push({
      orden: orden++,
      itemNumero: String(itemNum),
      rubro: safeStr(row[1]),
      descripcion: desc,
      unidad: safeStr(row[3]),
      cantidad: cant < 0 ? 0 : cant,
      matUd: safeNum(row[5] ?? null),
      moUd: safeNum(row[6] ?? null),
      eqUd: safeNum(row[7] ?? null),
      cdUd: safeNum(row[8] ?? null),
      precioVenta: row[13] != null ? safeNum(row[13]) : null,
      apuLinkCodigo: row[16] ? safeStr(row[16]) : null,
      fuente: row[18] ? safeStr(row[18]) : null,
    });
  }

  return { titulo, coefGGBB, mesCac, lineas };
}

function deriveObraFromTitle(titulo: string): { nombre: string; codigo: string } {
  // "PRESUPUESTO GDR 3760 — GENERADOR" → nombre: "GDR 3760", codigo: "GDR-3760"
  const match = titulo.match(/([A-Z]{2,}\s+\d{3,}[A-Z0-9]*)/i);
  if (match) {
    const nombre = match[1].trim();
    const codigo = nombre.replace(/\s+/g, "-").toUpperCase();
    return { nombre, codigo };
  }
  return { nombre: titulo.replace(/PRESUPUESTO\s*/i, "").replace(/—.*$/, "").trim(), codigo: "OBRA-001" };
}

export async function importUnified(buffer: Buffer): Promise<UnifiedImportSummary> {
  const errores: string[] = [];

  // 1. Parse APU data (insumos, partidas, composiciones) — includes SUBCONTRATOS_PRY
  const { data: apuData, errors: parseErrors } = parseAPUExcel(buffer);
  if (!apuData) {
    throw new Error("No se pudo parsear el archivo: " + parseErrors.map((e) => e.message).join(", "));
  }
  const warnings = parseErrors.map((e) => `[${e.sheet}] ${e.message}`);

  // 2. Import APU entities
  const apuSummary = await importAPU(apuData);
  errores.push(...apuSummary.errores);

  // 3. Parse PPTO_GENERADOR and CONFIG
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: "buffer" });
  } catch {
    throw new Error("No se pudo leer el archivo .xlsx");
  }

  const { titulo, coefGGBB, mesCac, lineas } = parsePPTOGenerador(wb);

  if (lineas.length === 0) {
    return {
      ...apuSummary,
      lineasPresupuesto: 0,
      obraId: "",
      obraNombre: titulo,
      warnings,
      errores,
    };
  }

  // 4. Upsert Obra
  const { nombre: obraNombre, codigo: obraCodigo } = deriveObraFromTitle(titulo);

  const obra = await prisma.obra.upsert({
    where: { codigo: obraCodigo },
    create: { nombre: obraNombre, codigo: obraCodigo, estado: "EN_CURSO" },
    update: { nombre: obraNombre },
  });

  // 5. Invalidate previous presupuestos vigentes
  await prisma.presupuestoHeader.updateMany({
    where: { obraId: obra.id, estado: "vigente" },
    data: { estado: "reemplazado" },
  });

  // 6. Create new PresupuestoHeader
  const header = await prisma.presupuestoHeader.create({
    data: {
      obraId: obra.id,
      fecha: new Date(),
      cacValor: 0,
      mesCac: mesCac,
      nombre: titulo,
      version: parseConfig(wb).version || undefined,
      coefGGBB,
    },
  });

  // 7. Load partida map for linking
  const allPartidas = await prisma.partida.findMany({ select: { id: true, codigo: true } });
  const partidaByCode = new Map(allPartidas.map((p) => [p.codigo.toUpperCase(), p.id]));

  // 8. Create LineaPresupuesto rows
  let lineasCount = 0;
  for (const linea of lineas) {
    const partidaId = linea.apuLinkCodigo
      ? (partidaByCode.get(linea.apuLinkCodigo.toUpperCase()) ?? null)
      : null;

    try {
      await prisma.lineaPresupuesto.create({
        data: {
          obraId: obra.id,
          presupuestoHeaderId: header.id,
          partidaId,
          descripcionLibre: partidaId ? null : linea.descripcion,
          cantidad: linea.cantidad,
          precioUnitarioSnapshot: linea.cdUd,
          tipo: "APU",
          estadoItem: "OK",
          rubro: linea.rubro || "GENERAL",
          itemNumero: linea.itemNumero,
          orden: linea.orden,
          matUd: linea.matUd > 0 ? linea.matUd : null,
          moUd: linea.moUd > 0 ? linea.moUd : null,
          eqUd: linea.eqUd > 0 ? linea.eqUd : null,
          precioVenta: linea.precioVenta,
          fuente: linea.fuente,
          apuLinkCodigo: linea.apuLinkCodigo,
        },
      });
      lineasCount++;
    } catch (err) {
      errores.push(`Línea ${linea.itemNumero}: ${err instanceof Error ? err.message : "error"}`);
    }
  }

  return {
    insumos: apuSummary.insumos,
    partidas: apuSummary.partidas,
    composiciones: apuSummary.composiciones,
    lineasPresupuesto: lineasCount,
    obraId: obra.id,
    obraNombre,
    warnings,
    errores,
  };
}

import * as XLSX from "xlsx";
import prisma from "../prisma/client";

export interface PresupuestoImportOptions {
  obraId: string;
  cacValor: number;
  mesCac: string;
  buffer: Buffer;
}

export interface PresupuestoImportSummary {
  lineas: number;
  vinculadas: number;
  sinVincular: number;
  errores: string[];
}

function safeStr(val: unknown, fallback = ""): string {
  if (val === null || val === undefined) return fallback;
  return String(val).trim();
}

function safeNum(val: unknown, fallback = 0): number {
  if (val === null || val === undefined || val === "") return fallback;
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

interface PresuRow {
  rubro: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  precioUnitario: number;
  codigoPartida?: string;
}

function parsePresupuestoSheet(sheet: XLSX.WorkSheet): PresuRow[] {
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true, header: 1 });
  const result: PresuRow[] = [];
  let currentRubro = "GENERAL";

  // Find header row index by looking for known column names
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const vals = Object.values(rows[i]).map((v) => safeStr(v).toLowerCase());
    if (
      vals.some((v) => v.includes("descripci") || v.includes("partida")) &&
      vals.some((v) => v.includes("cantidad") || v.includes("cant"))
    ) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    // Fallback: assume first row is header
    headerIdx = 0;
  }

  const headers = Object.values(rows[headerIdx]).map((v) => safeStr(v).toLowerCase());

  const colIdx = (names: string[]): number => {
    for (const name of names) {
      const idx = headers.findIndex((h) => h.includes(name));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const descCol = colIdx(["descripci", "partida", "ítem", "item"]);
  const unidCol = colIdx(["unidad", "ud", "unit"]);
  const cantCol = colIdx(["cantidad", "cant"]);
  const precioCol = colIdx(["precio", "p.unit", "p unit", "pu"]);
  const codigoCol = colIdx(["código", "codigo", "cod"]);
  const rubroCol = colIdx(["rubro", "capitulo", "capítulo"]);

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = Object.values(rows[i]);
    const desc = safeStr(row[descCol > -1 ? descCol : 1]);
    if (!desc) continue;

    const cant = safeNum(row[cantCol > -1 ? cantCol : 3]);
    const precio = safeNum(row[precioCol > -1 ? precioCol : 4]);

    // Detect rubro header rows: no quantity and no price (or zero both)
    if (cant === 0 && precio === 0) {
      if (rubroCol > -1) {
        const rubroVal = safeStr(row[rubroCol]);
        if (rubroVal) currentRubro = rubroVal;
      } else {
        currentRubro = desc;
      }
      continue;
    }

    result.push({
      rubro: rubroCol > -1 ? safeStr(row[rubroCol]) || currentRubro : currentRubro,
      descripcion: desc,
      unidad: safeStr(row[unidCol > -1 ? unidCol : 2]),
      cantidad: cant,
      precioUnitario: precio,
      codigoPartida: codigoCol > -1 ? safeStr(row[codigoCol]) || undefined : undefined,
    });
  }

  return result;
}

export async function importPresupuesto(opts: PresupuestoImportOptions): Promise<PresupuestoImportSummary> {
  const errores: string[] = [];

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(opts.buffer, { type: "buffer" });
  } catch {
    throw new Error("No se pudo leer el archivo .xlsx");
  }

  // Try sheet named "01", then first sheet
  const sheetName = workbook.SheetNames.find((s) => s === "01") ?? workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = parsePresupuestoSheet(sheet);

  if (rows.length === 0) {
    throw new Error("No se encontraron líneas de presupuesto en el archivo");
  }

  const [obra, allPartidas] = await Promise.all([
    prisma.obra.findUnique({ where: { id: opts.obraId } }),
    prisma.partida.findMany({ select: { id: true, codigo: true, descripcion: true } }),
  ]);

  if (!obra) throw new Error("Obra no encontrada");

  const partidaByCode = new Map(allPartidas.map((p) => [p.codigo.toUpperCase(), p.id]));
  const partidaByDesc = new Map(allPartidas.map((p) => [p.descripcion.toUpperCase(), p.id]));

  const header = await prisma.presupuestoHeader.create({
    data: {
      obraId: opts.obraId,
      fecha: new Date(),
      cacValor: opts.cacValor,
      mesCac: opts.mesCac,
    },
  });

  let vinculadas = 0;
  let sinVincular = 0;

  for (const row of rows) {
    let partidaId: string | null = null;

    if (row.codigoPartida) {
      partidaId = partidaByCode.get(row.codigoPartida.toUpperCase()) ?? null;
    }
    if (!partidaId) {
      partidaId = partidaByDesc.get(row.descripcion.toUpperCase()) ?? null;
    }

    if (partidaId) {
      vinculadas++;
    } else {
      sinVincular++;
    }

    try {
      await prisma.lineaPresupuesto.create({
        data: {
          obraId: opts.obraId,
          presupuestoHeaderId: header.id,
          partidaId,
          cantidad: row.cantidad,
          precioUnitarioSnapshot: row.precioUnitario,
          descripcionLibre: partidaId ? null : row.descripcion,
          estadoItem: "OK",
          rubro: row.rubro,
        },
      });
    } catch (err) {
      errores.push(`Línea "${row.descripcion}": ${err instanceof Error ? err.message : "error"}`);
    }
  }

  return { lineas: rows.length, vinculadas, sinVincular, errores };
}

import https from "https";
import http from "http";
import * as XLSX from "xlsx";
import prisma from "../../prisma/client";

interface ICCResult {
  mes: number;
  anio: number;
  variacionMensual: number | null;
  variacionAnual: number | null;
  valorAbsoluto: number | null;
  fuente: "argly" | "indec_ftp" | "indec_sipm";
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function fetchJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, { headers: { "User-Agent": "brickly/1.0" } }, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        try { resolve(JSON.parse(body)); }
        catch { reject(new Error(`JSON inválido desde ${url}`)); }
      });
    });
    req.on("error", reject);
    req.setTimeout(10_000, () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

function fetchBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, { headers: { "User-Agent": "brickly/1.0" } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchBuffer(res.headers.location).then(resolve).catch(reject);
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    });
    req.on("error", reject);
    req.setTimeout(25_000, () => { req.destroy(); reject(new Error("Timeout FTP INDEC")); });
  });
}

// ─── Fuente A: Argly (tercero — variaciones solamente) ────────────────────────

async function fetchFromArgly(): Promise<ICCResult | null> {
  try {
    const data = await fetchJson("https://api.argly.com.ar/v1/construccion") as {
      data?: { mes: number; anio: number; variaciones?: { general?: number }; variacion_anual?: { general?: number } };
    };
    const d = data?.data;
    if (!d?.mes || !d?.anio) return null;
    return {
      mes: d.mes,
      anio: d.anio,
      variacionMensual: d.variaciones?.general ?? null,
      variacionAnual: d.variacion_anual?.general ?? null,
      valorAbsoluto: null, // Argly no da el valor absoluto
      fuente: "argly",
    };
  } catch (err) {
    console.warn("[indec] Argly falló:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── Fuente B: SIPM de INDEC (valores absolutos — para calcular coeficiente) ──
// El archivo op_icc_sipm_2016.xls contiene la serie completa base Oct 2015 = 100.
// Se sobreescribe in-place cada mes ~día 20.

const MESES_SIPM: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12,
};

async function fetchAbsoluteFromSipm(): Promise<{ mes: number; anio: number; valorAbsoluto: number } | null> {
  try {
    const buf = await fetchBuffer(
      "https://www.indec.gob.ar/ftp/cuadros/economia/op_icc_sipm_2016.xls"
    );
    const wb = XLSX.read(buf, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][];

    // Buscar columna con "Nivel general" o similar, y la columna de período
    // El SIPM tiene filas con período en col 0 (ej "Ene-26") y el nivel general en alguna col
    // Buscar la última fila con un valor numérico válido
    let nivelGeneralCol = -1;
    for (let c = 0; c < (rows[0]?.length ?? 0); c++) {
      const h = String(rows[0]?.[c] ?? "").toLowerCase();
      if (h.includes("general") || h.includes("nivel")) {
        nivelGeneralCol = c;
        break;
      }
    }
    // Si no encontramos por header, usar columna 1 (la más común en el SIPM)
    if (nivelGeneralCol < 0) nivelGeneralCol = 1;

    // Buscar última fila con datos numéricos
    for (let i = rows.length - 1; i >= 1; i--) {
      const row = rows[i];
      if (!row) continue;
      const periodoStr = String(row[0] ?? "").trim().toLowerCase();
      const valor = typeof row[nivelGeneralCol] === "number" ? row[nivelGeneralCol] as number : null;
      if (!periodoStr || valor === null || valor <= 0) continue;

      // Parsear "ene-26" → mes=1, anio=2026
      const parts = periodoStr.split(/[-\/]/);
      if (parts.length < 2) continue;
      const mes = MESES_SIPM[parts[0].slice(0, 3)];
      const anioRaw = parseInt(parts[1], 10);
      if (!mes || isNaN(anioRaw)) continue;
      const anio = anioRaw < 100 ? 2000 + anioRaw : anioRaw;

      return { mes, anio, valorAbsoluto: valor };
    }
    return null;
  } catch (err) {
    console.warn("[indec] SIPM falló:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── Fuente C: INDEC FTP variaciones (fallback si Argly cae) ──────────────────

async function fetchFromIndecFtp(): Promise<ICCResult | null> {
  try {
    const buf = await fetchBuffer(
      "https://www.indec.gob.ar/ftp/cuadros/economia/icc_variaciones_2016.xls"
    );
    const wb = XLSX.read(buf, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][];

    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i]?.[1] !== undefined && rows[i]?.[1] !== null && rows[i]?.[1] !== "") {
        const lastRow = rows[i];
        const periodo = String(lastRow?.[0] ?? "").trim();
        const [mesStr, anioStr] = periodo.split("-");
        const mes = MESES_SIPM[mesStr.toLowerCase().slice(0, 3)];
        const anio = anioStr ? 2000 + parseInt(anioStr, 10) : null;
        if (!mes || !anio) return null;

        const variacionMensual = typeof lastRow[1] === "number" ? lastRow[1] * 100 : null;
        const variacionAnual = typeof lastRow[2] === "number" ? lastRow[2] * 100 : null;
        return { mes, anio, variacionMensual, variacionAnual, valorAbsoluto: null, fuente: "indec_ftp" };
      }
    }
    return null;
  } catch (err) {
    console.warn("[indec] FTP variaciones falló:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── Lógica principal ─────────────────────────────────────────────────────────

export async function fetchAndStoreLatestICC(): Promise<IndiceICCRecord | null> {
  // Intentar fuentes en paralelo para reducir latencia
  const [arglyResult, sipmResult] = await Promise.all([
    fetchFromArgly(),
    fetchAbsoluteFromSipm(),
  ]);

  // Combinar: Argly da variaciones, SIPM da el valor absoluto
  let base = arglyResult ?? (await fetchFromIndecFtp());
  if (!base) {
    console.warn("[indec] No se pudo obtener el ICC desde ninguna fuente.");
    return null;
  }

  // Si tenemos el valor absoluto del SIPM del mismo mes, lo agregamos
  let valorAbsoluto: number | null = base.valorAbsoluto;
  if (sipmResult && sipmResult.mes === base.mes && sipmResult.anio === base.anio) {
    valorAbsoluto = sipmResult.valorAbsoluto;
  } else if (sipmResult) {
    // El SIPM puede tener un mes diferente (ej: SIPM actualizó antes que Argly).
    // Upsert el registro del SIPM también.
    await prisma.indiceICC.upsert({
      where: { mes_anio: { mes: sipmResult.mes, anio: sipmResult.anio } },
      update: { valorAbsoluto: sipmResult.valorAbsoluto, fetchedAt: new Date() },
      create: {
        mes: sipmResult.mes, anio: sipmResult.anio,
        valorAbsoluto: sipmResult.valorAbsoluto,
        fuente: "indec_sipm", fetchedAt: new Date(),
      },
    });
  }

  const fuente = valorAbsoluto !== null && base.fuente === "argly" ? "indec_sipm" : base.fuente;

  const stored = await prisma.indiceICC.upsert({
    where: { mes_anio: { mes: base.mes, anio: base.anio } },
    update: {
      variacionMensual: base.variacionMensual,
      variacionAnual: base.variacionAnual,
      valorAbsoluto,
      fuente,
      fetchedAt: new Date(),
    },
    create: {
      mes: base.mes, anio: base.anio,
      variacionMensual: base.variacionMensual,
      variacionAnual: base.variacionAnual,
      valorAbsoluto,
      fuente,
      fetchedAt: new Date(),
    },
  });

  console.log(`[indec] ICC ${base.mes}/${base.anio} guardado — variación: ${base.variacionMensual}% | absoluto: ${valorAbsoluto ?? "N/D"}`);
  return stored;
}

export type IndiceICCRecord = Awaited<ReturnType<typeof prisma.indiceICC.findFirst>>;

export async function ensureCurrentMonthICC(): Promise<void> {
  const now = new Date();
  const mes = now.getMonth() + 1;
  const anio = now.getFullYear();
  const existing = await prisma.indiceICC.findUnique({ where: { mes_anio: { mes, anio } } });
  if (!existing) {
    await fetchAndStoreLatestICC();
  }
}

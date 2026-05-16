import { Prisma } from "@prisma/client";
import prisma from "../prisma/client";
import { ParsedAPU } from "./apu-parser.service";

export interface ImportAPUSummary {
  insumos: number;
  partidas: number;
  composiciones: number;
  errores: string[];
}

export async function importAPU(parsed: ParsedAPU): Promise<ImportAPUSummary> {
  const errores: string[] = [];

  // Batch upsert insumos — single SQL round-trip instead of N upserts
  let insumoCount = 0;
  if (parsed.insumos.length > 0) {
    try {
      const rows = parsed.insumos.map((i) =>
        Prisma.sql`(gen_random_uuid(), ${i.codigo}, ${i.descripcion}, ${i.tipo}::"TipoInsumo", ${i.unidad}, ${i.precioReferencia}, ${i.proveedor ?? null}, ${i.categoria ?? null}, ${i.codigoOriginal ?? null}, ${i.fechaCotizacion ?? null}, now(), now())`
      );
      await prisma.$executeRaw`
        INSERT INTO "Insumo" (id, codigo, descripcion, tipo, unidad, "precioReferencia", proveedor, categoria, "codigoOriginal", "fechaCotizacion", "createdAt", "updatedAt")
        VALUES ${Prisma.join(rows, ",")}
        ON CONFLICT (codigo) DO UPDATE SET
          descripcion       = EXCLUDED.descripcion,
          tipo              = EXCLUDED.tipo,
          unidad            = EXCLUDED.unidad,
          "precioReferencia" = EXCLUDED."precioReferencia",
          proveedor         = EXCLUDED.proveedor,
          categoria         = EXCLUDED.categoria,
          "codigoOriginal"  = EXCLUDED."codigoOriginal",
          "fechaCotizacion" = EXCLUDED."fechaCotizacion",
          "updatedAt"       = now()
      `;
      insumoCount = parsed.insumos.length;
    } catch (err) {
      errores.push(`Error guardando insumos: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Batch upsert partidas — single SQL round-trip
  let partidaCount = 0;
  if (parsed.partidas.length > 0) {
    try {
      const rows = parsed.partidas.map((p) =>
        Prisma.sql`(gen_random_uuid(), ${p.codigo}, ${p.descripcion}, ${p.rubro}, ${p.unidad}, ${p.rendimiento ?? null}, 'APU'::"TipoPartida", true, now(), now())`
      );
      await prisma.$executeRaw`
        INSERT INTO "Partida" (id, codigo, descripcion, rubro, unidad, rendimiento, tipo, activa, "createdAt", "updatedAt")
        VALUES ${Prisma.join(rows, ",")}
        ON CONFLICT (codigo) DO UPDATE SET
          descripcion = EXCLUDED.descripcion,
          rubro       = EXCLUDED.rubro,
          unidad      = EXCLUDED.unidad,
          rendimiento = EXCLUDED.rendimiento,
          "updatedAt" = now()
      `;
      partidaCount = parsed.partidas.length;
    } catch (err) {
      errores.push(`Error guardando partidas: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Fetch IDs for composicion linking (2 queries total)
  const allInsumos = await prisma.insumo.findMany({ select: { id: true, codigo: true } });
  const insumoMap = new Map(allInsumos.map((i) => [i.codigo, i.id]));

  const allPartidas = await prisma.partida.findMany({ select: { id: true, codigo: true } });
  const partidaMap = new Map(allPartidas.map((p) => [p.codigo, p.id]));

  // Delete existing composiciones for affected partidas before recreating
  const affectedPartidaIds = [
    ...new Set(
      parsed.composiciones
        .map((c) => partidaMap.get(c.partidaCodigo))
        .filter((id): id is string => !!id)
    ),
  ];
  if (affectedPartidaIds.length > 0) {
    await prisma.composicion.deleteMany({ where: { partidaId: { in: affectedPartidaIds } } });
  }

  // Batch create composiciones
  const composicionData: {
    partidaId: string;
    insumoId: string;
    cantidadPorUnidad: number;
    pctDesperdicio: number;
    secuencia: number;
  }[] = [];

  for (const c of parsed.composiciones) {
    const partidaId = partidaMap.get(c.partidaCodigo);
    if (!partidaId) {
      errores.push(`Composición: partida "${c.partidaCodigo}" no encontrada`);
      continue;
    }
    const insumoId = insumoMap.get(c.insumoCodigo);
    if (!insumoId) {
      errores.push(`Composición: insumo "${c.insumoCodigo}" no encontrado`);
      continue;
    }
    composicionData.push({
      partidaId,
      insumoId,
      cantidadPorUnidad: c.cantidadPorUnidad,
      pctDesperdicio: c.pctDesperdicio,
      secuencia: c.secuencia,
    });
  }

  let compCount = 0;
  if (composicionData.length > 0) {
    try {
      const result = await prisma.composicion.createMany({ data: composicionData });
      compCount = result.count;
    } catch (err) {
      errores.push(`Error guardando composiciones: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { insumos: insumoCount, partidas: partidaCount, composiciones: compCount, errores };
}

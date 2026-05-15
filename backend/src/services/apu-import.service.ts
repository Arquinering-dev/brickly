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

  let insumoCount = 0;
  for (const insumo of parsed.insumos) {
    try {
      await prisma.insumo.upsert({
        where: { codigo: insumo.codigo },
        create: {
          codigo: insumo.codigo,
          descripcion: insumo.descripcion,
          tipo: insumo.tipo as import("@prisma/client").TipoInsumo,
          unidad: insumo.unidad,
          precioReferencia: insumo.precioReferencia,
          proveedor: insumo.proveedor ?? null,
          categoria: insumo.categoria ?? null,
          codigoOriginal: insumo.codigoOriginal ?? null,
          fechaCotizacion: insumo.fechaCotizacion ?? null,
        },
        update: {
          descripcion: insumo.descripcion,
          tipo: insumo.tipo as import("@prisma/client").TipoInsumo,
          unidad: insumo.unidad,
          precioReferencia: insumo.precioReferencia,
          proveedor: insumo.proveedor ?? null,
          categoria: insumo.categoria ?? null,
          codigoOriginal: insumo.codigoOriginal ?? null,
          fechaCotizacion: insumo.fechaCotizacion ?? null,
        },
      });
      insumoCount++;
    } catch (err) {
      errores.push(`Insumo ${insumo.codigo}: ${err instanceof Error ? err.message : "error"}`);
    }
  }

  let partidaCount = 0;
  for (const p of parsed.partidas) {
    try {
      await prisma.partida.upsert({
        where: { codigo: p.codigo },
        create: {
          codigo: p.codigo,
          descripcion: p.descripcion,
          rubro: p.rubro,
          unidad: p.unidad,
          rendimiento: p.rendimiento,
        },
        update: {
          descripcion: p.descripcion,
          rubro: p.rubro,
          unidad: p.unidad,
          rendimiento: p.rendimiento,
        },
      });
      partidaCount++;
    } catch (err) {
      errores.push(`Partida ${p.codigo}: ${err instanceof Error ? err.message : "error"}`);
    }
  }

  const allInsumos = await prisma.insumo.findMany({ select: { id: true, codigo: true } });
  const insumoMap = new Map(allInsumos.map((i) => [i.codigo, i.id]));

  const allPartidas = await prisma.partida.findMany({ select: { id: true, codigo: true } });
  const partidaMap = new Map(allPartidas.map((p) => [p.codigo, p.id]));

  // Clear existing composiciones for affected partidas before re-inserting (idempotent re-import)
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

  let compCount = 0;
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
    try {
      await prisma.composicion.create({
        data: {
          partidaId,
          insumoId,
          cantidadPorUnidad: c.cantidadPorUnidad,
          pctDesperdicio: c.pctDesperdicio,
          secuencia: c.secuencia,
        },
      });
      compCount++;
    } catch (err) {
      errores.push(`Composición ${c.partidaCodigo}/${c.insumoCodigo}: ${err instanceof Error ? err.message : "error"}`);
    }
  }

  return { insumos: insumoCount, partidas: partidaCount, composiciones: compCount, errores };
}

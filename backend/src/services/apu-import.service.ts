import prisma from "../prisma/client";
import { ParsedAPU } from "./apu-parser.service";

export interface ImportSummary {
  apuId: string;
  materiales: number;
  manosDeObra: number;
  equipos: number;
  partidas: number;
  composiciones: number;
  presupuestoLineas: number;
}

export async function importAPU(
  nombre: string,
  parsed: ParsedAPU
): Promise<ImportSummary> {
  return prisma.$transaction(async (tx) => {
    const apu = await tx.aPU.create({
      data: {
        nombre,
        mesBaseCAC: parsed.config.mesBaseCAC,
        cacBase: parsed.config.cacBase,
        coefCargasMO: parsed.config.coefCargasMO,
        ggPercent: parsed.config.ggPercent,
        bbPercent: parsed.config.bbPercent,
      },
    });

    // Upsert materials — update precio if código already exists
    let matCount = 0;
    for (const m of parsed.materiales) {
      await tx.material.upsert({
        where: { codigo: m.codigo },
        create: {
          codigo: m.codigo,
          descripcion: m.descripcion,
          unidad: m.unidad,
          precio: m.precio,
          proveedor: m.proveedor ?? null,
          categoria: m.categoria ?? null,
          apuId: apu.id,
        },
        update: {
          descripcion: m.descripcion,
          unidad: m.unidad,
          precio: m.precio,
          proveedor: m.proveedor ?? null,
          categoria: m.categoria ?? null,
          apuId: apu.id,
        },
      });
      matCount++;
    }

    let moCount = 0;
    for (const mo of parsed.manosDeObra) {
      await tx.manoDeObra.upsert({
        where: { codigo: mo.codigo },
        create: {
          codigo: mo.codigo,
          descripcion: mo.descripcion,
          salarioDia: mo.salarioDia,
          coefCargas: mo.coefCargas,
          tipo: mo.tipo,
          apuId: apu.id,
        },
        update: {
          descripcion: mo.descripcion,
          salarioDia: mo.salarioDia,
          coefCargas: mo.coefCargas,
          tipo: mo.tipo,
          apuId: apu.id,
        },
      });
      moCount++;
    }

    let eqCount = 0;
    for (const eq of parsed.equipos) {
      await tx.equipo.upsert({
        where: { codigo: eq.codigo },
        create: {
          codigo: eq.codigo,
          descripcion: eq.descripcion,
          costoTotal: eq.costoTotal,
          vidaDias: eq.vidaDias,
          costoDia: eq.costoDia,
          apuId: apu.id,
        },
        update: {
          descripcion: eq.descripcion,
          costoTotal: eq.costoTotal,
          vidaDias: eq.vidaDias,
          costoDia: eq.costoDia,
          apuId: apu.id,
        },
      });
      eqCount++;
    }

    let partidaCount = 0;
    for (const p of parsed.partidas) {
      await tx.partida.upsert({
        where: { codigo: p.codigo },
        create: {
          codigo: p.codigo,
          rubro: p.rubro,
          descripcion: p.descripcion,
          unidad: p.unidad,
          rendimiento: p.rendimiento,
          pctDesperdicioConsumibles: p.pctDesperdicioConsumibles,
          pctDesperdicioGeneral: p.pctDesperdicioGeneral,
          gradoDificultad: p.gradoDificultad,
          matUnitario: p.matUnitario,
          moUnitario: p.moUnitario,
          eqUnitario: p.eqUnitario,
          cdUnitario: p.cdUnitario,
          apuId: apu.id,
        },
        update: {
          rubro: p.rubro,
          descripcion: p.descripcion,
          unidad: p.unidad,
          rendimiento: p.rendimiento,
          pctDesperdicioConsumibles: p.pctDesperdicioConsumibles,
          pctDesperdicioGeneral: p.pctDesperdicioGeneral,
          gradoDificultad: p.gradoDificultad,
          matUnitario: p.matUnitario,
          moUnitario: p.moUnitario,
          eqUnitario: p.eqUnitario,
          cdUnitario: p.cdUnitario,
          apuId: apu.id,
        },
      });
      partidaCount++;
    }

    // Build lookup maps for composición
    const materialMap = new Map<string, string>();
    const moMap = new Map<string, string>();
    const equipoMap = new Map<string, string>();

    const allMats = await tx.material.findMany({ select: { id: true, codigo: true } });
    const allMOs = await tx.manoDeObra.findMany({ select: { id: true, codigo: true } });
    const allEqs = await tx.equipo.findMany({ select: { id: true, codigo: true } });
    const allPartidas = await tx.partida.findMany({ select: { id: true, codigo: true } });

    allMats.forEach((m) => materialMap.set(m.codigo, m.id));
    allMOs.forEach((m) => moMap.set(m.codigo, m.id));
    allEqs.forEach((e) => equipoMap.set(e.codigo, e.id));
    const partidaMap = new Map(allPartidas.map((p) => [p.codigo, p.id]));

    let compCount = 0;
    for (const c of parsed.composiciones) {
      const partidaId = partidaMap.get(c.partidaCodigo);
      if (!partidaId) continue;

      let insumoId: string | undefined;
      if (c.tipo === "MATERIAL") insumoId = materialMap.get(c.insumoCodigo);
      else if (c.tipo === "MANO_DE_OBRA") insumoId = moMap.get(c.insumoCodigo);
      else if (c.tipo === "EQUIPO") insumoId = equipoMap.get(c.insumoCodigo);
      if (!insumoId) continue;

      await tx.composicionPartida.create({
        data: {
          partidaId,
          tipo: c.tipo,
          insumoId,
          cantidadPorUnidad: c.cantidadPorUnidad,
          pctDesperdicio: c.pctDesperdicio,
          secuencia: c.secuencia,
        },
      });
      compCount++;
    }

    let pptoCount = 0;
    for (const l of parsed.presupuestoLineas) {
      const partidaId = partidaMap.get(l.codigoPartida);
      if (!partidaId) continue;

      await tx.presupuestoLinea.create({
        data: {
          apuId: apu.id,
          partidaId,
          cantidad: l.cantidad,
          matTotal: l.matTotal,
          moTotal: l.moTotal,
          eqTotal: l.eqTotal,
        },
      });
      pptoCount++;
    }

    return {
      apuId: apu.id,
      materiales: matCount,
      manosDeObra: moCount,
      equipos: eqCount,
      partidas: partidaCount,
      composiciones: compCount,
      presupuestoLineas: pptoCount,
    };
  });
}

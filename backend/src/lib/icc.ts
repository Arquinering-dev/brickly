import prisma from "../prisma/client";

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

export interface IccInfo {
  iccBase: number;          // valor absoluto del ICC al momento del presupuesto
  iccActual: number | null; // valor absoluto del ICC más reciente disponible
  coefICC: number | null;   // iccActual / iccBase — null si falta algún valor
  mesBase: string;          // "Jun 2025"
  mesActual: string | null; // "Abr 2026"
  variacionMensual: number | null;
}

// Devuelve el contexto ICC para un presupuesto dado su cacValor base y mesCac.
export async function getIccInfo(cacValorBase: number): Promise<IccInfo> {
  const latest = await prisma.indiceICC.findFirst({
    orderBy: [{ anio: "desc" }, { mes: "desc" }],
  });

  const mesActual = latest ? `${MESES[latest.mes - 1]} ${latest.anio}` : null;
  const iccActual = latest?.valorAbsoluto !== null && latest?.valorAbsoluto !== undefined
    ? Number(latest.valorAbsoluto)
    : null;
  const variacionMensual = latest?.variacionMensual !== null && latest?.variacionMensual !== undefined
    ? Number(latest.variacionMensual)
    : null;

  if (!cacValorBase || cacValorBase <= 0) {
    return { iccBase: cacValorBase, iccActual, coefICC: null, mesBase: "—", mesActual, variacionMensual };
  }

  const coefICC = iccActual !== null ? iccActual / cacValorBase : null;
  return { iccBase: cacValorBase, iccActual, coefICC, mesBase: "—", mesActual, variacionMensual };
}

// Versión liviana para adjuntar a listas (una sola query compartida).
export async function getLatestIccRaw() {
  const latest = await prisma.indiceICC.findFirst({
    orderBy: [{ anio: "desc" }, { mes: "desc" }],
  });
  if (!latest) return null;
  return {
    mes: latest.mes,
    anio: latest.anio,
    mesLabel: `${MESES[latest.mes - 1]} ${latest.anio}`,
    variacionMensual: latest.variacionMensual !== null ? Number(latest.variacionMensual) : null,
    variacionAnual: latest.variacionAnual !== null ? Number(latest.variacionAnual) : null,
    valorAbsoluto: latest.valorAbsoluto !== null ? Number(latest.valorAbsoluto) : null,
  };
}

// Calcula el coeficiente dado el valor base del presupuesto y el ICC actual.
export function calcCoefICC(cacValorBase: number, iccActualAbsoluto: number | null): number | null {
  if (!cacValorBase || cacValorBase <= 0 || iccActualAbsoluto === null) return null;
  return iccActualAbsoluto / cacValorBase;
}

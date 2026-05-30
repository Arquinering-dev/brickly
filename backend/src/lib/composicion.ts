// Explosión composición → insumo: cantidad consumida de un insumo para una línea
// de presupuesto. Única fuente de verdad (antes estaba duplicada en obras.routes).
//
//   MO / EQUIPO: días = (cantidadPorUnidad / rendimiento) × cantLínea
//                (rendimiento = unidades de partida ejecutadas por día)
//   MATERIAL / SUBCONTRATO: cantidadPorUnidad × (1 + pctDesperdicio) × cantLínea
export function calcCantInsumo(
  tipoInsumo: string,
  cantidadPorUnidad: number,
  pctDesperdicio: number,
  rendimiento: number | null | undefined,
  cantLinea: number,
): number {
  if (tipoInsumo === "MANO_DE_OBRA" || tipoInsumo === "EQUIPO") {
    const rend = Number(rendimiento) || 0;
    if (rend > 0) return (cantidadPorUnidad / rend) * cantLinea;
    return cantidadPorUnidad * cantLinea;
  }
  return cantidadPorUnidad * (1 + pctDesperdicio) * cantLinea;
}

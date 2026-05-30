// Precio de venta y coeficiente GGBB (K) — centralizados.
//
// Antes el factor K = 1.3327 (el de la obra GDR) estaba hardcodeado en cada
// endpoint, lo que producía precios de venta INCORRECTOS para cualquier obra con
// otro coeficiente (p. ej. Chivilcoy). El coeficiente real vive por presupuesto en
// `PresupuestoHeader.coefGGBB`, y el precio de venta aprobado vive por línea en
// `LineaPresupuesto.precioVenta`. Estas funciones son la única fuente de verdad.

type Decimalish = { toString(): string } | number | string | null | undefined;

function num(v: Decimalish): number {
  if (v === null || v === undefined) return NaN;
  return typeof v === "number" ? v : Number(v.toString());
}

/** Coeficiente GGBB (K) del presupuesto. Fallback 1 si no está cargado (NO una constante de obra). */
export function coefGGBB(value: Decimalish): number {
  const n = num(value);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * Precio de venta UNITARIO de una línea de presupuesto.
 * Prioridad:
 *   1) precioVenta congelado del presupuesto aprobado, si existe (> 0);
 *   2) costo directo unitario × coeficiente GGBB del header (estimación del generador).
 */
export function precioVentaUnitario(
  precioVenta: Decimalish,
  precioUnitarioSnapshot: Decimalish,
  headerCoef: Decimalish,
): number {
  const pv = num(precioVenta);
  if (Number.isFinite(pv) && pv > 0) return pv;
  const cd = num(precioUnitarioSnapshot);
  return (Number.isFinite(cd) ? cd : 0) * coefGGBB(headerCoef);
}

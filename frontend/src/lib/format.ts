// Helpers de formato — únicos en toda la app, no duplicar inline.

export const fmtMoney = (n: number | string | null | undefined, opts: { compact?: boolean } = {}) => {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "—";
  if (opts.compact) {
    return v.toLocaleString("es-AR", {
      style: "currency",
      currency: "ARS",
      notation: "compact",
      maximumFractionDigits: 1,
    });
  }
  return v.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
};

export const fmtNum = (n: number | string | null | undefined, dec = 2) => {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
};

export const fmtPct = (n: number | null | undefined, dec = 1) => {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(dec)}%`;
};

export const fmtDate = (d: string | Date | null | undefined, fmt: "short" | "long" | "month" = "short") => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  if (fmt === "long") return date.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
  if (fmt === "month") return date.toLocaleDateString("es-AR", { month: "short", year: "2-digit" });
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });
};

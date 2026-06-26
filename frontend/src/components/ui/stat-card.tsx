import * as React from "react";
import { cn } from "../../lib/cn";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  trend,
  variant = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  trend?: { value: number; direction: "up" | "down" | "flat"; label?: string };
  variant?: "default" | "dark" | "brand" | "accent";
  className?: string;
}) {
  const variants: Record<string, string> = {
    default: "bg-white border-slate-200 text-slate-900",
    dark:    "bg-slate-900 border-slate-900 text-white",
    brand:   "bg-gradient-to-br from-brand-700 to-brand-900 border-brand-800 text-white",
    accent:  "bg-gradient-to-br from-accent-500 to-accent-700 border-accent-600 text-white",
  };
  const labelClass = variant === "default" ? "text-slate-500" : "text-white/60";
  const hintClass  = variant === "default" ? "text-slate-500" : "text-white/50";

  return (
    <div className={cn("rounded-lg border shadow-sm p-5", variants[variant], className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className={cn("text-2xs font-medium uppercase tracking-wider font-display", labelClass)}>{label}</p>
          <p className="text-2xl font-bold stat-number truncate">{value}</p>
        </div>
        {Icon && (
          <div className={cn("shrink-0 grid place-items-center rounded p-2",
            variant === "default" ? "bg-brand-50 text-brand-700" : "bg-white/10 text-white"
          )}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      {(hint || trend) && (
        <div className={cn("flex items-center gap-2 mt-3 text-xs", hintClass)}>
          {trend && (
            <span className={cn("font-semibold",
              trend.direction === "up"   && "text-success-500",
              trend.direction === "down" && "text-danger-500"
            )}>
              {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"} {Math.abs(trend.value).toFixed(1)}%
            </span>
          )}
          {hint && <span>{hint}</span>}
        </div>
      )}
    </div>
  );
}

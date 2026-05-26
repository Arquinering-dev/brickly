import * as React from "react";
import { cn } from "../../lib/cn";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-16 px-6 rounded-2xl bg-stone-50/50 border border-dashed border-stone-200", className)}>
      {Icon && (
        <div className="mb-4 grid place-items-center h-12 w-12 rounded-full bg-white shadow-sm border border-stone-200 text-stone-400">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <h3 className="text-sm font-semibold text-stone-800">{title}</h3>
      {description && <p className="text-xs text-stone-500 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium border transition-colors",
  {
    variants: {
      variant: {
        default: "bg-slate-100 text-slate-700 border-slate-200",
        brand:   "bg-brand-50 text-brand-800 border-brand-100",
        accent:  "bg-accent-50 text-accent-800 border-accent-100",
        success: "bg-success-50 text-success-700 border-success-100",
        warning: "bg-amber-50 text-amber-700 border-amber-100",
        info:    "bg-info-50 text-info-700 border-info-100",
        danger:  "bg-danger-50 text-danger-700 border-danger-100",
        outline: "bg-transparent text-slate-600 border-slate-300",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

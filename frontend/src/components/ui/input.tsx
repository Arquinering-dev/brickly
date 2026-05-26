import * as React from "react";
import { cn } from "../../lib/cn";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-9 w-full rounded-lg border border-stone-200 bg-white px-3 py-1 text-sm shadow-xs",
        "placeholder:text-stone-400",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 focus-visible:border-brand-400",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-stone-50",
        "transition-colors",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[80px] w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm shadow-xs",
        "placeholder:text-stone-400",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 focus-visible:border-brand-400",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("text-xs font-medium text-stone-600 mb-1 block", className)}
      {...props}
    />
  )
);
Label.displayName = "Label";

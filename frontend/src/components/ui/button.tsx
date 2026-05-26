import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-brand-700 text-white shadow-sm hover:bg-brand-800 active:bg-brand-900",
        primary: "bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800",
        secondary: "bg-stone-100 text-stone-900 hover:bg-stone-200",
        outline: "border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 hover:border-stone-300",
        ghost: "text-stone-700 hover:bg-stone-100",
        destructive: "bg-danger-500 text-white shadow-sm hover:bg-danger-600",
        link: "text-brand-600 underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-4",
        lg: "h-10 px-5",
        icon: "h-9 w-9 p-0",
        "icon-sm": "h-7 w-7 p-0 [&_svg]:size-3.5",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { buttonVariants };

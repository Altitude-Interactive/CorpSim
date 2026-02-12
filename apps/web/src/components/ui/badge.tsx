import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "border-primary/30 bg-primary/15 text-primary",
        success: "border-emerald-600/30 bg-emerald-600/15 text-emerald-400",
        info: "border-blue-600/30 bg-blue-600/15 text-blue-300",
        warning: "border-amber-600/30 bg-amber-600/15 text-amber-300",
        danger: "border-red-600/30 bg-red-600/15 text-red-300",
        muted: "border-border bg-muted/60 text-muted-foreground"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };

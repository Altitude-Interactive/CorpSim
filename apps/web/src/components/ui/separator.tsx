import * as React from "react";
import { cn } from "@/lib/utils";

export type SeparatorProps = React.HTMLAttributes<HTMLDivElement>;

function Separator({ className, ...props }: SeparatorProps) {
  return <div className={cn("h-px w-full bg-border", className)} {...props} />;
}

export { Separator };

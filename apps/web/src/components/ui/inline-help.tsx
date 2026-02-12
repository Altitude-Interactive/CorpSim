import { CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineHelpProps {
  label: string;
  className?: string;
}

export function InlineHelp({ label, className }: InlineHelpProps) {
  return (
    <span
      className={cn("inline-flex items-center text-muted-foreground", className)}
      aria-label={label}
      role="img"
      title={label}
    >
      <CircleHelp className="h-3.5 w-3.5" />
    </span>
  );
}

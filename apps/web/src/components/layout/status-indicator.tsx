import { cn } from "@/lib/utils";
import { getSystemStatusCopy, UI_COPY } from "@/lib/ui-copy";

type StatusLevel = "green" | "yellow" | "red";

const statusStyles: Record<StatusLevel, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-red-500"
};

export function StatusIndicator({ status }: { status: StatusLevel }) {
  const copy = getSystemStatusCopy(status);

  return (
    <div className="inline-flex items-center gap-2" title={copy.description}>
      <span className={cn("h-2.5 w-2.5 rounded-full", statusStyles[status])} />
      <span className="text-xs text-muted-foreground">{`${UI_COPY.status.labelPrefix}: ${copy.label}`}</span>
    </div>
  );
}

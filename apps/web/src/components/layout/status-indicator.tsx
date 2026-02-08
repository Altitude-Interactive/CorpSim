import { cn } from "@/lib/utils";

type StatusLevel = "green" | "yellow" | "red";

const statusStyles: Record<StatusLevel, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-red-500"
};

export function StatusIndicator({ status }: { status: StatusLevel }) {
  return (
    <div className="inline-flex items-center gap-2">
      <span className={cn("h-2.5 w-2.5 rounded-full", statusStyles[status])} />
      <span className="text-xs text-muted-foreground uppercase tracking-wide">API {status}</span>
    </div>
  );
}

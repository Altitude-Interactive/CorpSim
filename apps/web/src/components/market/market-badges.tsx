import { Badge } from "@/components/ui/badge";
import { formatCodeLabel } from "@/lib/ui-copy";

export function SideBadge({ side }: { side: "BUY" | "SELL" }) {
  return <Badge variant={side === "BUY" ? "success" : "warning"}>{formatCodeLabel(side)}</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  if (status === "OPEN") {
    return <Badge variant="info">{formatCodeLabel(status)}</Badge>;
  }
  if (status === "FILLED") {
    return <Badge variant="success">{formatCodeLabel(status)}</Badge>;
  }
  if (status === "CANCELLED") {
    return <Badge variant="muted">{formatCodeLabel(status)}</Badge>;
  }

  return <Badge variant="muted">{formatCodeLabel(status)}</Badge>;
}

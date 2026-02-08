import { Badge } from "@/components/ui/badge";

export function SideBadge({ side }: { side: "BUY" | "SELL" }) {
  return <Badge variant={side === "BUY" ? "success" : "warning"}>{side}</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  if (status === "OPEN") {
    return <Badge variant="info">OPEN</Badge>;
  }
  if (status === "FILLED") {
    return <Badge variant="success">FILLED</Badge>;
  }
  if (status === "CANCELLED") {
    return <Badge variant="muted">CANCELLED</Badge>;
  }

  return <Badge variant="muted">{status}</Badge>;
}

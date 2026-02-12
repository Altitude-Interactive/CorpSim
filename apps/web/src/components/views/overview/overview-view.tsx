"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWorldHealth } from "@/components/layout/world-health-provider";
import { formatCents, formatInt } from "@/lib/format";
import { UI_CADENCE_TERMS } from "@/lib/ui-terms";

export function OverviewView() {
  const { health } = useWorldHealth();

  if (!health) {
    return <div className="text-sm text-muted-foreground">Loading overview metrics...</div>;
  }

  const kpis = [
    { label: `Current ${UI_CADENCE_TERMS.singularTitle}`, value: formatInt(health.currentTick) },
    { label: "Open Orders", value: formatInt(health.ordersOpenCount) },
    { label: "Trades (Last 100)", value: formatInt(health.tradesLast100Count) },
    { label: "Companies", value: formatInt(health.companiesCount) },
    { label: "Total Cash", value: formatCents(health.sumCashCents) },
    { label: "Reserved Cash", value: formatCents(health.sumReservedCashCents) }
  ];

  return (
    <div className="space-y-4">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">{kpi.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold tracking-tight tabular-nums">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Invariants
            <Badge variant={health.invariants.hasViolations ? "danger" : "success"}>
              {health.invariants.hasViolations ? "Violations" : "Healthy"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {health.invariants.issues.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invariant violations detected.</p>
          ) : (
            <ul className="space-y-2">
              {health.invariants.issues.slice(0, 10).map((issue, index) => (
                <li key={`${issue.code}-${index}`} className="rounded-md border border-border bg-muted/30 p-2">
                  <p className="text-xs font-medium text-foreground">{issue.code}</p>
                  <p className="text-xs text-muted-foreground">{issue.message}</p>
                  <p className="text-xs text-muted-foreground">
                    company={issue.companyId}
                    {issue.itemId ? ` item=${issue.itemId}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

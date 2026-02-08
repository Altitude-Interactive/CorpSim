"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketAnalyticsSummary } from "@/lib/api";
import { formatCents } from "@/lib/format";

function formatNullableCents(value: string | null): string {
  if (value === null) {
    return "--";
  }
  return formatCents(value);
}

function formatChangePct(changePctBps: number | null): string {
  if (changePctBps === null) {
    return "--";
  }

  const pct = changePctBps / 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

interface AnalyticsKpiCardsProps {
  summary: MarketAnalyticsSummary | null;
  isLoading: boolean;
}

export function AnalyticsKpiCards({ summary, isLoading }: AnalyticsKpiCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Last Price</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xl font-semibold tabular-nums">
            {formatNullableCents(summary?.lastPriceCents ?? null)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Change (Window)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xl font-semibold tabular-nums">
            {formatChangePct(summary?.changePctBps ?? null)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">High / Low</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm tabular-nums">
            {formatNullableCents(summary?.highCents ?? null)} /{" "}
            {formatNullableCents(summary?.lowCents ?? null)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Avg Volume</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xl font-semibold tabular-nums">
            {(summary?.avgVolumeQty ?? 0).toLocaleString()}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">VWAP (Window)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xl font-semibold tabular-nums">
            {formatNullableCents(summary?.vwapCents ?? null)}
          </p>
          {isLoading ? <p className="mt-1 text-xs text-muted-foreground">Refreshing...</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

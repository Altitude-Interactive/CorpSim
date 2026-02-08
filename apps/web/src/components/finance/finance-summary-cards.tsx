"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FinanceSummary } from "@/lib/api";
import { formatCents } from "@/lib/format";

interface FinanceSummaryCardsProps {
  summary: FinanceSummary | null;
  isLoading: boolean;
}

function renderValue(value: string | null): string {
  if (value === null) {
    return "--";
  }
  return formatCents(value);
}

export function FinanceSummaryCards({ summary, isLoading }: FinanceSummaryCardsProps) {
  const startingCash = summary?.startingCashCents ?? null;
  const endingCash = summary?.endingCashCents ?? null;
  const deltaCash = summary?.totalDeltaCashCents ?? null;
  const deltaReserved = summary?.totalDeltaReservedCashCents ?? null;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Cash Start (Window)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xl font-semibold tabular-nums">{renderValue(startingCash)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Cash End (Window)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xl font-semibold tabular-nums">{renderValue(endingCash)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Net Cash Delta</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xl font-semibold tabular-nums">{renderValue(deltaCash)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Net Reserved Delta</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xl font-semibold tabular-nums">{renderValue(deltaReserved)}</p>
          {isLoading ? <p className="mt-2 text-xs text-muted-foreground">Refreshing...</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorldHealth } from "@/lib/api";
import { formatCents } from "@/lib/format";
import { UI_CADENCE_TERMS } from "@/lib/ui-terms";

interface WorldKpiCardsProps {
  health: WorldHealth | null;
  isLoading: boolean;
}

interface KpiItem {
  key: string;
  label: string;
  value: string;
}

function toDisplayDate(value: string | null): string {
  if (!value) {
    return "--";
  }
  return new Date(value).toLocaleString();
}

function buildKpiItems(health: WorldHealth | null): KpiItem[] {
  if (!health) {
    return [];
  }

  return [
    {
      key: "currentTick",
      label: `Current ${UI_CADENCE_TERMS.singularTitle}`,
      value: health.currentTick.toLocaleString()
    },
    {
      key: "lockVersion",
      label: "Lock Version",
      value: health.lockVersion.toLocaleString()
    },
    {
      key: "lastAdvancedAt",
      label: "Last Advanced",
      value: toDisplayDate(health.lastAdvancedAt)
    },
    {
      key: "ordersOpenCount",
      label: "Open Orders",
      value: health.ordersOpenCount.toLocaleString()
    },
    {
      key: "tradesLast100Count",
      label: "Trades (Last 100)",
      value: health.tradesLast100Count.toLocaleString()
    },
    {
      key: "companiesCount",
      label: "Companies",
      value: health.companiesCount.toLocaleString()
    },
    {
      key: "botsCount",
      label: "Bots",
      value: health.botsCount.toLocaleString()
    },
    {
      key: "sumCashCents",
      label: "Total Cash",
      value: formatCents(health.sumCashCents)
    },
    {
      key: "sumReservedCashCents",
      label: "Reserved Cash",
      value: formatCents(health.sumReservedCashCents)
    }
  ];
}

function KpiSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="h-6 w-32 animate-pulse rounded bg-muted" />
      </CardContent>
    </Card>
  );
}

export function WorldKpiCards({ health, isLoading }: WorldKpiCardsProps) {
  const items = buildKpiItems(health);

  if (isLoading && !health) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>World KPIs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 9 }).map((_, index) => (
              <KpiSkeleton key={`world-kpi-skeleton-${index}`} />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isLoading && !health) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>World KPIs</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            World metrics are unavailable right now.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>World KPIs</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <Card key={item.key}>
              <CardContent className="space-y-2 p-4">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="tabular-nums text-lg font-semibold">{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

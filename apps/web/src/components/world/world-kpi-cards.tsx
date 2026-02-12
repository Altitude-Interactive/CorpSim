"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineHelp } from "@/components/ui/inline-help";
import { WorldHealth } from "@/lib/api";
import { formatCents } from "@/lib/format";
import { UI_CADENCE_TERMS } from "@/lib/ui-terms";
import { UI_COPY } from "@/lib/ui-copy";

interface WorldKpiCardsProps {
  health: WorldHealth | null;
  isLoading: boolean;
  showDiagnostics: boolean;
}

interface KpiItem {
  key: string;
  label: string;
  value: string;
  href: string;
  helpText?: string;
}

function buildKpiItems(health: WorldHealth | null, showDiagnostics: boolean): KpiItem[] {
  if (!health) {
    return [];
  }

  const items: KpiItem[] = [
    {
      key: "currentTick",
      label: `Current ${UI_CADENCE_TERMS.singularTitle}`,
      value: health.currentTick.toLocaleString(),
      href: "/overview"
    },
    {
      key: "ordersOpenCount",
      label: "Open Orders",
      value: health.ordersOpenCount.toLocaleString(),
      href: "/market"
    },
    {
      key: "tradesLast100Count",
      label: "Trades (Last 100)",
      value: health.tradesLast100Count.toLocaleString(),
      href: "/market",
      helpText: UI_COPY.help.tradesLast100
    },
    {
      key: "companiesCount",
      label: "Companies",
      value: health.companiesCount.toLocaleString(),
      href: "/overview"
    },
    {
      key: "sumCashCents",
      label: "Total Cash",
      value: formatCents(health.sumCashCents),
      href: "/finance"
    },
    {
      key: "sumReservedCashCents",
      label: "Reserved Cash",
      value: formatCents(health.sumReservedCashCents),
      href: "/finance",
      helpText: UI_COPY.help.reservedCash
    }
  ];

  if (showDiagnostics) {
    items.push({
      key: "botsCount",
      label: "Automated Companies",
      value: health.botsCount.toLocaleString(),
      href: "/overview"
    });
  }

  return items;
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

export function WorldKpiCards({ health, isLoading, showDiagnostics }: WorldKpiCardsProps) {
  const items = buildKpiItems(health, showDiagnostics);

  if (isLoading && !health) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Operational KPIs</CardTitle>
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
          <CardTitle>Operational KPIs</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Operational metrics are unavailable right now.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Operational KPIs</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <Card key={item.key}>
              <CardContent className="space-y-2 p-4">
                <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <span>{item.label}</span>
                  {item.helpText ? <InlineHelp label={item.helpText} /> : null}
                </p>
                <p className="tabular-nums text-lg font-semibold">{item.value}</p>
                <Button asChild variant="ghost" size="sm" className="h-auto px-0 text-xs">
                  <Link href={item.href}>Open</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWorldHealth } from "@/components/layout/world-health-provider";
import { formatCents, formatInt } from "@/lib/format";
import { fetchDiscordServerUrlFromMeta, getDiscordServerUrl } from "@/lib/public-links";
import { UI_CADENCE_TERMS } from "@/lib/ui-terms";
import { getDocumentationUrl, UI_COPY } from "@/lib/ui-copy";

export function OverviewView() {
  const { health } = useWorldHealth();
  const [discordServerUrl, setDiscordServerUrl] = useState<string | null>(() => getDiscordServerUrl());

  useEffect(() => {
    if (discordServerUrl) {
      return;
    }

    const controller = new AbortController();
    void fetchDiscordServerUrlFromMeta(controller.signal).then((url) => {
      if (!url) {
        return;
      }
      setDiscordServerUrl(url);
    });

    return () => {
      controller.abort();
    };
  }, [discordServerUrl]);

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
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-tutorial-id="overview-kpis">
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

      <Card data-tutorial-id="overview-integrity">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>System Integrity</CardTitle>
            <Badge variant={health.invariants.hasViolations ? "danger" : "success"}>
              {health.invariants.hasViolations ? "Issues detected" : "All checks passed"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {health.invariants.issues.length === 0 ? (
            <p className="text-sm text-muted-foreground">No integrity issues detected.</p>
          ) : (
            <ul className="space-y-2">
              {health.invariants.issues.slice(0, 10).map((issue, index) => (
                <li key={`${issue.code}-${index}`} className="rounded-md border border-border bg-muted/30 p-2">
                  <p className="text-xs text-muted-foreground">{issue.message}</p>
                </li>
              ))}
            </ul>
          )}
          <Button asChild variant="ghost" size="sm" className="h-auto px-0 text-xs">
            <Link href="/world">Open World Status</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Alpha Preview Notice</CardTitle>
            <Badge variant="warning">ALPHA</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This preview is provided as-is with no player support. Progress and economy data may be
            reset or wiped at any time until beta.
          </p>
          {discordServerUrl ? (
            <Button asChild size="sm" variant="outline">
              <a href={discordServerUrl} target="_blank" rel="noreferrer">
                Join Discord for Updates
              </a>
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card data-tutorial-id="overview-docs">
        <CardHeader>
          <CardTitle>{UI_COPY.documentation.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{UI_COPY.documentation.description}</p>
          <Button asChild size="sm" variant="outline">
            <a href={getDocumentationUrl("/overview")} target="_blank" rel="noreferrer">
              {UI_COPY.documentation.openCta}
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

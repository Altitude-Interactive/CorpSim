"use client";

import { RefreshCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorldHealth } from "@/lib/api";
import { formatCadencePoint, UI_CADENCE_TERMS } from "@/lib/ui-terms";
import { getSystemStatusCopy, UiStatusLevel, UI_COPY } from "@/lib/ui-copy";

interface WorldStatusHeaderProps {
  health: WorldHealth | null;
  isLoading: boolean;
  statusLevel: UiStatusLevel;
  lastUpdatedLabel: string;
  showTechnicalCadence: boolean;
  onRefresh: () => void;
}

function resolveBadgeVariant(status: UiStatusLevel): "success" | "warning" | "danger" {
  if (status === "green") {
    return "success";
  }
  if (status === "yellow") {
    return "warning";
  }
  return "danger";
}

function formatLastSimulationRun(value: string | null | undefined): string {
  if (!value) {
    return "--";
  }

  return new Date(value).toLocaleString();
}

export function WorldStatusHeader({
  health,
  isLoading,
  statusLevel,
  lastUpdatedLabel,
  showTechnicalCadence,
  onRefresh
}: WorldStatusHeaderProps) {
  const statusCopy = getSystemStatusCopy(statusLevel);
  const currentWeek = health?.currentTick ?? null;
  const cadenceLabel = formatCadencePoint(currentWeek);
  const cadenceWithTechnical =
    showTechnicalCadence && currentWeek !== null
      ? `${cadenceLabel} (Technical tick: ${currentWeek.toLocaleString()})`
      : cadenceLabel;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div className="space-y-1">
          <CardTitle>{UI_COPY.world.title}</CardTitle>
          <p className="text-sm text-muted-foreground">{UI_COPY.world.subtitle}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
          <RefreshCcw className="mr-2 h-3.5 w-3.5" />
          {UI_COPY.world.refresh}
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">{UI_COPY.status.labelPrefix}</p>
          <div className="mt-1">
            <Badge variant={resolveBadgeVariant(statusLevel)}>{statusCopy.label}</Badge>
          </div>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">{UI_COPY.world.lastSimulationRun}</p>
          <p className="mt-1 text-sm tabular-nums">{formatLastSimulationRun(health?.lastAdvancedAt)}</p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">{UI_COPY.world.nextExpectedWeek}</p>
          <p className="mt-1 text-sm tabular-nums">
            {health ? `${UI_CADENCE_TERMS.singularTitle} ${(health.currentTick + 1).toLocaleString()}` : "--"}
          </p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">Last updated</p>
          <p className="mt-1 text-sm tabular-nums">{lastUpdatedLabel}</p>
          <p className="mt-1 text-xs text-muted-foreground">{cadenceWithTechnical}</p>
        </div>
      </CardContent>
    </Card>
  );
}

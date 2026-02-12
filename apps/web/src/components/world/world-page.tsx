"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { advanceWorld, getWorldHealth, resetWorld, WorldHealth } from "@/lib/api";
import { formatCadenceCount, UI_CADENCE_TERMS } from "@/lib/ui-terms";
import { UiStatusLevel, UI_COPY } from "@/lib/ui-copy";
import { WorldInvariantsTable } from "./world-invariants-table";
import { WorldKpiCards } from "./world-kpi-cards";
import { WorldStatusHeader } from "./world-status-header";

const DEV_MODE_STORAGE_KEY = "corpsim.devMode";

function readDevModeFromStorage(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(DEV_MODE_STORAGE_KEY) === "true";
}

export function WorldPage() {
  const { showToast } = useToast();
  const [health, setHealth] = useState<WorldHealth | null>(null);
  const [ticksInput, setTicksInput] = useState("1");
  const [isLoadingHealth, setIsLoadingHealth] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [devMode, setDevMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDevMode(readDevModeFromStorage());
  }, []);

  const loadWorldHealth = useCallback(async () => {
    setIsLoadingHealth(true);
    try {
      const snapshot = await getWorldHealth();
      setHealth(snapshot);
      setHealthError(null);
      setLastUpdatedAt(new Date());
    } catch (caught) {
      setHealthError(caught instanceof Error ? caught.message : "Failed to load world health");
    } finally {
      setIsLoadingHealth(false);
    }
  }, []);

  useEffect(() => {
    void loadWorldHealth();
  }, [loadWorldHealth]);

  const lastUpdatedLabel = useMemo(() => {
    if (lastUpdatedAt === null) {
      return "Never";
    }
    return lastUpdatedAt.toLocaleString();
  }, [lastUpdatedAt]);

  const statusLevel = useMemo<UiStatusLevel>(() => {
    if (!health && healthError) {
      return "red";
    }

    if (healthError || !health) {
      return "yellow";
    }

    return "green";
  }, [health, healthError]);

  const toggleDevMode = (next: boolean) => {
    setDevMode(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DEV_MODE_STORAGE_KEY, next ? "true" : "false");
    }
  };

  const runAdvance = async () => {
    const parsed = Number.parseInt(ticksInput, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setError(`${UI_CADENCE_TERMS.pluralTitle} must be a positive integer.`);
      return;
    }

    if (parsed > 10) {
      const confirmed = window.confirm(
        `Advance by ${formatCadenceCount(parsed)}? This may process many events.`
      );
      if (!confirmed) {
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await advanceWorld(parsed);
      setError(null);
      showToast({
        title: "Simulation advanced",
        description: `${formatCadenceCount(parsed)} applied`,
        variant: "success"
      });
      await loadWorldHealth();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Failed to advance world";
      setError(message);
      showToast({
        title: "Advance failed",
        description: message,
        variant: "error"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const runReset = async () => {
    const confirmed = window.confirm(
      "Reset world and reseed? This will wipe current simulation state."
    );
    if (!confirmed) {
      return;
    }

    setIsSubmitting(true);
    try {
      await resetWorld(true);
      setError(null);
      showToast({
        title: "Simulation reset",
        description: "Simulation was reset and reseeded.",
        variant: "success"
      });
      await loadWorldHealth();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Failed to reset world";
      setError(message);
      showToast({
        title: "Reset failed",
        description: message,
        variant: "error"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <WorldStatusHeader
        health={health}
        isLoading={isLoadingHealth}
        statusLevel={statusLevel}
        lastUpdatedLabel={lastUpdatedLabel}
        showTechnicalCadence={devMode}
        onRefresh={() => {
          void loadWorldHealth();
        }}
      />

      {healthError ? (
        <Alert variant="destructive">
          <AlertTitle>{UI_COPY.world.errors.syncIssueTitle}</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{healthError}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void loadWorldHealth();
              }}
              disabled={isLoadingHealth}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <WorldKpiCards health={health} isLoading={isLoadingHealth} showDiagnostics={devMode} />
      <WorldInvariantsTable
        invariants={health?.invariants ?? null}
        isLoading={isLoadingHealth}
        showTechnicalDetails={devMode}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>{UI_COPY.world.diagnostics.title}</CardTitle>
          {devMode ? <Badge variant="warning">Enabled</Badge> : <Badge variant="muted">Disabled</Badge>}
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={devMode}
              onChange={(event) => toggleDevMode(event.target.checked)}
            />
            {UI_COPY.world.diagnostics.toggleLabel}
          </label>
          <p className="text-xs text-muted-foreground">{UI_COPY.world.diagnostics.hint}</p>

          {devMode ? (
            <>
              <p className="text-xs font-medium text-muted-foreground">
                {UI_COPY.world.diagnostics.controlsTitle}
              </p>
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/20 p-3">
                <Input
                  className="w-40"
                  value={ticksInput}
                  onChange={(event) => setTicksInput(event.target.value)}
                  placeholder={UI_CADENCE_TERMS.pluralTitle}
                />
                <Button onClick={() => void runAdvance()} disabled={isSubmitting}>
                  {UI_COPY.world.diagnostics.advance}
                </Button>
                <Button variant="destructive" onClick={() => void runReset()} disabled={isSubmitting}>
                  {UI_COPY.world.diagnostics.reset}
                </Button>
                {error ? <p className="text-sm text-red-300">{error}</p> : null}
              </div>
              {health ? (
                <details className="rounded-md border border-border bg-muted/20 p-3 text-xs">
                  <summary className="cursor-pointer font-medium text-muted-foreground">
                    Technical details
                  </summary>
                  <div className="mt-2 space-y-1 font-mono text-xs text-muted-foreground">
                    <p>lockVersion: {health.lockVersion.toLocaleString()}</p>
                    <p>currentTick: {health.currentTick.toLocaleString()}</p>
                    <p>ordersTotalCount: {health.ordersTotalCount.toLocaleString()}</p>
                  </div>
                </details>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

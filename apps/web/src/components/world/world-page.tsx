"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { advanceWorld, getWorldHealth, resetWorld, WorldHealth } from "@/lib/api";
import { formatCadenceCount, UI_CADENCE_TERMS } from "@/lib/ui-terms";
import { WorldInvariantsTable } from "./world-invariants-table";
import { WorldKpiCards } from "./world-kpi-cards";

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
        title: "World advanced",
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
        title: "World reset",
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
      <Alert variant="warning">
        <AlertTitle>Dev Controls</AlertTitle>
        <AlertDescription>
          World mutation actions are hidden unless Dev Mode is explicitly enabled.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Dev Mode</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={devMode}
              onChange={(event) => toggleDevMode(event.target.checked)}
            />
            Enable Dev Mode
          </label>
          <p className="text-xs text-muted-foreground">
            {`Cadence is displayed as ${UI_CADENCE_TERMS.plural} in UI (internally stored as ticks).`}
          </p>
        </CardContent>
      </Card>

      {devMode ? (
        <Card>
          <CardHeader>
            <CardTitle>World Controls</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Input
              className="w-40"
              value={ticksInput}
              onChange={(event) => setTicksInput(event.target.value)}
              placeholder={UI_CADENCE_TERMS.pluralTitle}
            />
            <Button onClick={() => void runAdvance()} disabled={isSubmitting}>
              {`Advance ${UI_CADENCE_TERMS.pluralTitle}`}
            </Button>
            <Button variant="destructive" onClick={() => void runReset()} disabled={isSubmitting}>
              Reset + Reseed
            </Button>
            {error ? <p className="text-sm text-red-300">{error}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>World Health Summary</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Last updated: {lastUpdatedLabel}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void loadWorldHealth();
            }}
            disabled={isLoadingHealth}
          >
            Refresh World Health
          </Button>
        </CardHeader>
        <CardContent>
          {healthError ? (
            <Alert variant="destructive">
              <AlertTitle>World Health Sync Issue</AlertTitle>
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
        </CardContent>
      </Card>

      <WorldKpiCards health={health} isLoading={isLoadingHealth} />
      <WorldInvariantsTable invariants={health?.invariants ?? null} isLoading={isLoadingHealth} />
    </div>
  );
}

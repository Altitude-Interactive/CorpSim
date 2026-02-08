"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useWorldHealth } from "@/components/layout/world-health-provider";
import { useToast } from "@/components/ui/toast";
import { advanceWorld, resetWorld } from "@/lib/api";

const DEV_MODE_STORAGE_KEY = "corpsim.devMode";

function readDevModeFromStorage(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(DEV_MODE_STORAGE_KEY) === "true";
}

export function WorldPage() {
  const { showToast } = useToast();
  const { health, refresh } = useWorldHealth();
  const [ticksInput, setTicksInput] = useState("1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [devMode, setDevMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDevMode(readDevModeFromStorage());
  }, []);

  const summary = useMemo(() => {
    if (!health) {
      return null;
    }

    return {
      currentTick: health.currentTick,
      lockVersion: health.lockVersion,
      lastAdvancedAt: health.lastAdvancedAt,
      ordersOpenCount: health.ordersOpenCount,
      ordersTotalCount: health.ordersTotalCount,
      tradesLast100Count: health.tradesLast100Count,
      companiesCount: health.companiesCount,
      botsCount: health.botsCount,
      sumCashCents: health.sumCashCents,
      sumReservedCashCents: health.sumReservedCashCents,
      invariants: health.invariants
    };
  }, [health]);

  const toggleDevMode = (next: boolean) => {
    setDevMode(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DEV_MODE_STORAGE_KEY, next ? "true" : "false");
    }
  };

  const runAdvance = async () => {
    const parsed = Number.parseInt(ticksInput, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setError("Ticks must be a positive integer.");
      return;
    }

    if (parsed > 10) {
      const confirmed = window.confirm(`Advance by ${parsed} ticks? This may process many events.`);
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
        description: `${parsed} tick(s) applied`,
        variant: "success"
      });
      await refresh();
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
      await refresh();
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
              placeholder="Ticks"
            />
            <Button onClick={() => void runAdvance()} disabled={isSubmitting}>
              Advance World
            </Button>
            <Button variant="destructive" onClick={() => void runReset()} disabled={isSubmitting}>
              Reset + Reseed
            </Button>
            {error ? <p className="text-sm text-red-300">{error}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>World Health Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs">
            {summary ? JSON.stringify(summary, null, 2) : "Loading world summary..."}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

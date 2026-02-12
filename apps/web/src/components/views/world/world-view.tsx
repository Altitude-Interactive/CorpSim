"use client";

import { useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { advanceWorld, resetWorld } from "@/lib/api";
import { UI_CADENCE_TERMS } from "@/lib/ui-terms";
import { useWorldHealth } from "@/components/layout/world-health-provider";

export function WorldView() {
  const { health, refresh } = useWorldHealth();
  const [ticksInput, setTicksInput] = useState("1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      sumReservedCashCents: health.sumReservedCashCents
    };
  }, [health]);

  const runAdvance = async () => {
    const parsed = Number.parseInt(ticksInput, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setError(`${UI_CADENCE_TERMS.pluralTitle} must be a positive integer.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await advanceWorld(parsed);
      setError(null);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to advance world");
    } finally {
      setIsSubmitting(false);
    }
  };

  const runReset = async () => {
    setIsSubmitting(true);
    try {
      await resetWorld(true);
      setError(null);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to reset world");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Alert variant="warning">
        <AlertTitle>Dev Only Controls</AlertTitle>
        <AlertDescription>
          These controls mutate simulation state directly. Do not expose to production players.
        </AlertDescription>
      </Alert>

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

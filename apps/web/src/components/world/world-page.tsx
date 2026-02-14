"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ToastNotice } from "@/components/ui/toast-manager";
import { getWorldHealth, WorldHealth } from "@/lib/api";
import { UiStatusLevel, UI_COPY } from "@/lib/ui-copy";
import { WorldInvariantsTable } from "./world-invariants-table";
import { WorldKpiCards } from "./world-kpi-cards";
import { WorldStatusHeader } from "./world-status-header";

export function WorldPage() {
  const [health, setHealth] = useState<WorldHealth | null>(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const loadWorldHealth = useCallback(async () => {
    setIsLoadingHealth(true);
    try {
      const snapshot = await getWorldHealth();
      setHealth(snapshot);
      setHealthError(null);
      setLastUpdatedAt(new Date());
    } catch (caught) {
      setHealthError(caught instanceof Error ? caught.message : "Failed to load world status");
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

  return (
    <div className="space-y-4">
      <WorldStatusHeader
        health={health}
        isLoading={isLoadingHealth}
        statusLevel={statusLevel}
        lastUpdatedLabel={lastUpdatedLabel}
        showTechnicalCadence={false}
        onRefresh={() => {
          void loadWorldHealth();
        }}
      />

      {healthError ? (
        <ToastNotice
          variant="danger"
          title={UI_COPY.world.errors.syncIssueTitle}
          description={healthError}
          action={
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
          }
        />
      ) : null}

      <WorldKpiCards health={health} isLoading={isLoadingHealth} showDiagnostics={false} />
      <WorldInvariantsTable
        invariants={health?.invariants ?? null}
        isLoading={isLoadingHealth}
        showTechnicalDetails={false}
      />
    </div>
  );
}

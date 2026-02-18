"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useActiveCompany } from "@/components/company/active-company-provider";
import { useWorldHealth } from "@/components/layout/world-health-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TableSkeletonRows } from "@/components/ui/table-skeleton-rows";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToastNotice, useToast } from "@/components/ui/toast-manager";
import {
  CompanyWorkforce,
  getCompanyWorkforce,
  requestCompanyWorkforceCapacityChange,
  setCompanyWorkforceAllocation
} from "@/lib/api";
import { formatCents } from "@/lib/format";
import { UI_CADENCE_TERMS } from "@/lib/ui-terms";
import { UI_COPY } from "@/lib/ui-copy";

const WORKFORCE_REFRESH_DEBOUNCE_MS = 600;

interface AllocationDraft {
  operationsPct: string;
  researchPct: string;
  logisticsPct: string;
  corporatePct: string;
}

function toPercent(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

function toInteger(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function toAllocationDraft(workforce: CompanyWorkforce): AllocationDraft {
  return {
    operationsPct: String(workforce.workforceAllocationOpsPct),
    researchPct: String(workforce.workforceAllocationRngPct),
    logisticsPct: String(workforce.workforceAllocationLogPct),
    corporatePct: String(workforce.workforceAllocationCorpPct)
  };
}

export function WorkforcePage() {
  const { showToast } = useToast();
  const { activeCompanyId } = useActiveCompany();
  const { health } = useWorldHealth();
  const [workforce, setWorkforce] = useState<CompanyWorkforce | null>(null);
  const [allocationDraft, setAllocationDraft] = useState<AllocationDraft>({
    operationsPct: "40",
    researchPct: "20",
    logisticsPct: "20",
    corporatePct: "20"
  });
  const [capacityDeltaInput, setCapacityDeltaInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedWorkforce, setHasLoadedWorkforce] = useState(false);
  const [isSavingAllocation, setIsSavingAllocation] = useState(false);
  const [isRequestingCapacity, setIsRequestingCapacity] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedWorkforceRef = useRef(false);

  const loadWorkforce = useCallback(async (options?: { showLoadingState?: boolean }) => {
    const showLoadingState = options?.showLoadingState ?? !hasLoadedWorkforceRef.current;
    if (!activeCompanyId) {
      setWorkforce(null);
      if (showLoadingState) {
        setIsLoading(false);
      }
      if (!hasLoadedWorkforceRef.current) {
        hasLoadedWorkforceRef.current = true;
        setHasLoadedWorkforce(true);
      }
      return;
    }

    if (showLoadingState) {
      setIsLoading(true);
    }
    try {
      const snapshot = await getCompanyWorkforce(activeCompanyId);
      setWorkforce(snapshot);
      setAllocationDraft(toAllocationDraft(snapshot));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load workforce data");
    } finally {
      if (showLoadingState) {
        setIsLoading(false);
      }
      if (!hasLoadedWorkforceRef.current) {
        hasLoadedWorkforceRef.current = true;
        setHasLoadedWorkforce(true);
      }
    }
  }, [activeCompanyId]);

  useEffect(() => {
    void loadWorkforce({ showLoadingState: true });
  }, [loadWorkforce]);

  useEffect(() => {
    if (health?.currentTick === undefined || !activeCompanyId) {
      return;
    }
    const timeout = setTimeout(() => {
      void loadWorkforce({ showLoadingState: false });
    }, WORKFORCE_REFRESH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [activeCompanyId, health?.currentTick, loadWorkforce]);

  const allocationValues = useMemo(
    () => ({
      operationsPct: toInteger(allocationDraft.operationsPct),
      researchPct: toInteger(allocationDraft.researchPct),
      logisticsPct: toInteger(allocationDraft.logisticsPct),
      corporatePct: toInteger(allocationDraft.corporatePct)
    }),
    [allocationDraft]
  );

  const allocationSum = useMemo(() => {
    const values = Object.values(allocationValues);
    if (values.some((value) => value === null)) {
      return null;
    }
    return (values[0] ?? 0) + (values[1] ?? 0) + (values[2] ?? 0) + (values[3] ?? 0);
  }, [allocationValues]);
  const allocationRemaining = allocationSum === null ? null : 100 - allocationSum;

  const handleAllocationSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeCompanyId) {
      setError(UI_COPY.common.selectCompanyFirst);
      return;
    }
    const operationsPct = allocationValues.operationsPct;
    const researchPct = allocationValues.researchPct;
    const logisticsPct = allocationValues.logisticsPct;
    const corporatePct = allocationValues.corporatePct;
    if (
      operationsPct === null ||
      researchPct === null ||
      logisticsPct === null ||
      corporatePct === null
    ) {
      setError("Allocation values must be integers.");
      return;
    }
    if (allocationSum !== 100) {
      setError("Allocation percentages must sum to 100.");
      return;
    }

    setIsSavingAllocation(true);
    try {
      const updated = await setCompanyWorkforceAllocation({
        companyId: activeCompanyId,
        operationsPct,
        researchPct,
        logisticsPct,
        corporatePct
      });
      setWorkforce(updated);
      setAllocationDraft(toAllocationDraft(updated));
      setError(null);
      showToast({
        title: "Allocation updated",
        description: "Organizational capacity allocation was saved.",
        variant: "success"
      });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Failed to update allocation";
      setError(message);
      showToast({
        title: "Allocation update failed",
        description: message,
        variant: "error"
      });
    } finally {
      setIsSavingAllocation(false);
    }
  };

  const handleCapacitySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeCompanyId) {
      setError(UI_COPY.common.selectCompanyFirst);
      return;
    }

    const deltaCapacity = Number.parseInt(capacityDeltaInput, 10);
    if (!Number.isInteger(deltaCapacity) || deltaCapacity === 0) {
      setError("Capacity delta must be a non-zero integer.");
      return;
    }

    setIsRequestingCapacity(true);
    try {
      const result = await requestCompanyWorkforceCapacityChange({
        companyId: activeCompanyId,
        deltaCapacity
      });
      await loadWorkforce();
      setCapacityDeltaInput("0");
      setError(null);
      showToast({
        title: "Capacity request submitted",
        description: result.appliedImmediately
          ? "Capacity change applied immediately."
          : `Hiring arrival scheduled for ${UI_CADENCE_TERMS.singular.toLowerCase()} ${result.tickArrives}.`,
        variant: "success"
      });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Failed to request capacity change";
      setError(message);
      showToast({
        title: "Capacity request failed",
        description: message,
        variant: "error"
      });
    } finally {
      setIsRequestingCapacity(false);
    }
  };

  if (!activeCompanyId) {
    return (
      <ToastNotice
        title={UI_COPY.common.noCompanySelected}
        description={UI_COPY.common.selectCompanyFirst}
      />
    );
  }

  const projected = workforce?.projectedModifiers;
  const showInitialSkeleton = isLoading && !hasLoadedWorkforce;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Organizational Capacity</CardTitle>
          <p className="text-sm text-muted-foreground">
            Workforce capacity determines production speed and research efficiency. Higher capacity allows faster operations, but increases weekly salary costs. Allocation percentages control which departments receive speed bonuses.
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Workforce Capacity</p>
            <p className="text-xl font-semibold tabular-nums">
              {workforce ? workforce.workforceCapacity.toLocaleString() : "--"}
            </p>
          </div>
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Weekly Salary Burn</p>
            <p className="text-xl font-semibold tabular-nums">
              {workforce ? formatCents(workforce.weeklySalaryBurnCents) : "--"}
            </p>
          </div>
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Organizational Efficiency</p>
            <p className="text-xl font-semibold tabular-nums">
              {workforce ? toPercent(workforce.orgEfficiencyBps) : "--"}
            </p>
          </div>
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Pending Hiring Arrivals</p>
            <p className="text-xl font-semibold tabular-nums">
              {workforce ? workforce.pendingHiringArrivals.length.toLocaleString() : "--"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Allocation Controls</CardTitle>
          <p className="text-sm text-muted-foreground">
            Distribute your workforce across departments. Higher allocation in each area provides speed bonuses. Total must equal 100%.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-5" onSubmit={handleAllocationSubmit}>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Operations %
              </label>
              <Input
                value={allocationDraft.operationsPct}
                onChange={(event) =>
                  setAllocationDraft((current) => ({ ...current, operationsPct: event.target.value }))
                }
                placeholder="e.g., 40"
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Research %
              </label>
              <Input
                value={allocationDraft.researchPct}
                onChange={(event) =>
                  setAllocationDraft((current) => ({ ...current, researchPct: event.target.value }))
                }
                placeholder="e.g., 20"
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Logistics %
              </label>
              <Input
                value={allocationDraft.logisticsPct}
                onChange={(event) =>
                  setAllocationDraft((current) => ({ ...current, logisticsPct: event.target.value }))
                }
                placeholder="e.g., 20"
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Corporate %
              </label>
              <Input
                value={allocationDraft.corporatePct}
                onChange={(event) =>
                  setAllocationDraft((current) => ({ ...current, corporatePct: event.target.value }))
                }
                placeholder="e.g., 20"
                inputMode="numeric"
              />
            </div>
            <Button type="submit" disabled={isSavingAllocation || allocationSum !== 100} className="self-end">
              Save Allocation
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            Remaining allocation: {allocationRemaining === null ? "--" : allocationRemaining}
          </p>
          <div className="grid gap-2 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground md:grid-cols-2 xl:grid-cols-3">
            <p>
              Production speed bonus:{" "}
              {projected ? toPercent(projected.productionSpeedBonusBps) : "--"}
            </p>
            <p>
              Research speed bonus: {projected ? toPercent(projected.researchSpeedBonusBps) : "--"}
            </p>
            <p>
              Logistics travel reduction:{" "}
              {projected ? toPercent(projected.logisticsTravelReductionBps) : "--"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Capacity Change</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form className="grid gap-3 md:grid-cols-[180px_auto]" onSubmit={handleCapacitySubmit}>
            <Input
              value={capacityDeltaInput}
              onChange={(event) => setCapacityDeltaInput(event.target.value)}
              placeholder="Enter change (e.g., +50 or -20)"
              inputMode="numeric"
            />
            <Button type="submit" disabled={isRequestingCapacity}>
              Request Change
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            Positive delta is a hiring wave and arrives in two weeks. Recruitment cost is posted
            immediately in the ledger. Negative delta applies immediately and reduces efficiency.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending Hiring Arrivals</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Delta Capacity</TableHead>
                <TableHead>{UI_CADENCE_TERMS.singularTitle} Arrives</TableHead>
                <TableHead>Created At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {showInitialSkeleton && (workforce?.pendingHiringArrivals.length ?? 0) === 0 ? (
                <TableSkeletonRows columns={4} />
              ) : null}
              {workforce?.pendingHiringArrivals.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">{row.id}</TableCell>
                  <TableCell className="tabular-nums">{row.deltaCapacity}</TableCell>
                  <TableCell className="tabular-nums">{row.tickArrives}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(row.createdAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
              {!showInitialSkeleton && (workforce?.pendingHiringArrivals.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No pending hiring arrivals.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Last updated: {workforce ? new Date(workforce.updatedAt).toLocaleString() : "--"}
      </p>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}


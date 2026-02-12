"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useActiveCompany } from "@/components/company/active-company-provider";
import { useWorldHealth } from "@/components/layout/world-health-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  ApiClientError,
  CompanyDetails,
  FinanceLedgerEntry,
  FinanceLedgerEntryType,
  FinanceSummary,
  getCompany,
  getFinanceSummary,
  listFinanceLedger
} from "@/lib/api";
import { UI_CADENCE_TERMS } from "@/lib/ui-terms";
import { FinanceBreakdownTable } from "./finance-breakdown-table";
import { FinanceLedgerTable } from "./finance-ledger-table";
import { FinanceReconciliationPanel } from "./finance-reconciliation-panel";
import { FinanceSummaryCards } from "./finance-summary-cards";

const FINANCE_REFRESH_DEBOUNCE_MS = 500;
const ROOT_CURSOR = "__root__";

const ENTRY_TYPE_OPTIONS: FinanceLedgerEntryType[] = [
  "ORDER_RESERVE",
  "TRADE_SETTLEMENT",
  "CONTRACT_SETTLEMENT",
  "RESEARCH_PAYMENT",
  "PRODUCTION_COMPLETION",
  "PRODUCTION_COST",
  "MANUAL_ADJUSTMENT"
];

interface FinanceFilterFormState {
  fromTick: string;
  toTick: string;
  entryType: "ALL" | FinanceLedgerEntryType;
  referenceType: string;
  referenceId: string;
  limit: string;
  windowTicks: string;
}

interface AppliedFinanceFilters {
  fromTick?: number;
  toTick?: number;
  entryType?: FinanceLedgerEntryType;
  referenceType?: string;
  referenceId?: string;
  limit: number;
  windowTicks: number;
}

const INITIAL_FILTERS: FinanceFilterFormState = {
  fromTick: "",
  toTick: "",
  entryType: "ALL",
  referenceType: "",
  referenceId: "",
  limit: "",
  windowTicks: ""
};

function parseOptionalNonNegativeInt(value: string, field: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${field} must be a non-negative integer`);
  }

  return parsed;
}

function parsePositiveInt(value: string, field: string, fallback: number, max: number): number {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return fallback;
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new Error(`${field} must be an integer between 1 and ${max}`);
  }

  return parsed;
}

function mapFinanceApiError(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === 403) {
      return "Forbidden for selected company.";
    }
    return error.message;
  }
  return error instanceof Error ? error.message : "Unexpected finance error";
}

export function FinancePage() {
  const { showToast } = useToast();
  const { activeCompany, activeCompanyId } = useActiveCompany();
  const { health } = useWorldHealth();

  const [form, setForm] = useState<FinanceFilterFormState>(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<AppliedFinanceFilters>({
    limit: 100,
    windowTicks: 100
  });

  const [currentCursor, setCurrentCursor] = useState<string | undefined>(undefined);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<FinanceLedgerEntry[]>([]);
  const [latestLedgerEntry, setLatestLedgerEntry] = useState<FinanceLedgerEntry | null>(null);
  const [company, setCompany] = useState<CompanyDetails | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFinance = useCallback(async () => {
    if (!activeCompanyId) {
      setSummary(null);
      setLedgerEntries([]);
      setLatestLedgerEntry(null);
      setCompany(null);
      setNextCursor(null);
      return;
    }

    setIsLoading(true);
    try {
      const [summaryPayload, ledgerPayload, companyPayload, latestLedgerPayload] = await Promise.all([
        getFinanceSummary(activeCompanyId, appliedFilters.windowTicks),
        listFinanceLedger({
          companyId: activeCompanyId,
          fromTick: appliedFilters.fromTick,
          toTick: appliedFilters.toTick,
          entryType: appliedFilters.entryType,
          referenceType: appliedFilters.referenceType,
          referenceId: appliedFilters.referenceId,
          limit: appliedFilters.limit,
          cursor: currentCursor
        }),
        getCompany(activeCompanyId),
        listFinanceLedger({
          companyId: activeCompanyId,
          limit: 1
        })
      ]);

      setSummary(summaryPayload);
      setLedgerEntries(ledgerPayload.entries);
      setNextCursor(ledgerPayload.nextCursor);
      setCompany(companyPayload);
      setLatestLedgerEntry(latestLedgerPayload.entries[0] ?? null);
      setError(null);
    } catch (caught) {
      setError(mapFinanceApiError(caught));
    } finally {
      setIsLoading(false);
    }
  }, [activeCompanyId, appliedFilters, currentCursor]);

  useEffect(() => {
    void loadFinance();
  }, [loadFinance]);

  useEffect(() => {
    const tick = health?.currentTick;
    if (tick === undefined || !activeCompanyId) {
      return;
    }

    const timeout = setTimeout(() => {
      void loadFinance();
    }, FINANCE_REFRESH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [health?.currentTick, activeCompanyId, loadFinance]);

  const submitFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const fromTick = parseOptionalNonNegativeInt(form.fromTick, UI_CADENCE_TERMS.fromField);
      const toTick = parseOptionalNonNegativeInt(form.toTick, UI_CADENCE_TERMS.toField);
      if (fromTick !== undefined && toTick !== undefined && fromTick > toTick) {
        throw new Error(`${UI_CADENCE_TERMS.fromField} cannot be greater than ${UI_CADENCE_TERMS.toField}`);
      }

      const nextAppliedFilters: AppliedFinanceFilters = {
        fromTick,
        toTick,
        entryType: form.entryType === "ALL" ? undefined : form.entryType,
        referenceType: form.referenceType.trim() || undefined,
        referenceId: form.referenceId.trim() || undefined,
        limit: parsePositiveInt(form.limit, "limit", 100, 500),
        windowTicks: parsePositiveInt(form.windowTicks, UI_CADENCE_TERMS.windowField, 100, 10_000)
      };

      setCursorHistory([]);
      setCurrentCursor(undefined);
      setAppliedFilters(nextAppliedFilters);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Invalid filter values");
    }
  };

  const resetFilters = () => {
    setForm(INITIAL_FILTERS);
    setAppliedFilters({
      limit: 100,
      windowTicks: 100
    });
    setCursorHistory([]);
    setCurrentCursor(undefined);
    setError(null);
  };

  const onNextPage = () => {
    if (!nextCursor) {
      return;
    }
    setCursorHistory((history) => [...history, currentCursor ?? ROOT_CURSOR]);
    setCurrentCursor(nextCursor);
  };

  const onPreviousPage = () => {
    setCursorHistory((history) => {
      if (history.length === 0) {
        return history;
      }

      const copy = [...history];
      const previousCursor = copy.pop();
      setCurrentCursor(previousCursor === ROOT_CURSOR ? undefined : previousCursor);
      return copy;
    });
  };

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showToast({
        title: `${label} copied`,
        description: value,
        variant: "success"
      });
    } catch {
      showToast({
        title: "Copy failed",
        description: "Clipboard permission denied.",
        variant: "error"
      });
    }
  };

  const counters = useMemo(
    () => ({
      tradesCount: summary?.tradesCount ?? 0,
      ordersPlacedCount: summary?.ordersPlacedCount ?? 0,
      ordersCancelledCount: summary?.ordersCancelledCount ?? 0,
      productionsCompletedCount: summary?.productionsCompletedCount ?? 0
    }),
    [summary]
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Finance Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 lg:grid-cols-4" onSubmit={submitFilters}>
            <Input
              placeholder={UI_CADENCE_TERMS.fromField}
              value={form.fromTick}
              onChange={(event) => setForm((prev) => ({ ...prev, fromTick: event.target.value }))}
            />
            <Input
              placeholder={UI_CADENCE_TERMS.toField}
              value={form.toTick}
              onChange={(event) => setForm((prev) => ({ ...prev, toTick: event.target.value }))}
            />
            <Select
              value={form.entryType}
              onValueChange={(value) =>
                setForm((prev) => ({ ...prev, entryType: value as FinanceFilterFormState["entryType"] }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Entry type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All entry types</SelectItem>
                {ENTRY_TYPE_OPTIONS.map((entryType) => (
                  <SelectItem key={entryType} value={entryType}>
                    {entryType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="referenceType"
              value={form.referenceType}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, referenceType: event.target.value }))
              }
            />
            <Input
              placeholder="referenceId contains..."
              value={form.referenceId}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, referenceId: event.target.value }))
              }
            />
            <Input
              placeholder="limit (default 100, max 500)"
              value={form.limit}
              onChange={(event) => setForm((prev) => ({ ...prev, limit: event.target.value }))}
            />
            <Input
              placeholder={`${UI_CADENCE_TERMS.windowField} (default 100, max 10000)`}
              value={form.windowTicks}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, windowTicks: event.target.value }))
              }
            />
            <div className="flex items-center gap-2">
              <Button type="submit">Apply</Button>
              <Button type="button" variant="outline" onClick={resetFilters}>
                Reset
              </Button>
            </div>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            Active company:{" "}
            {activeCompany ? `${activeCompany.code} - ${activeCompany.name}` : "No company selected"}
          </p>
          {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
        </CardContent>
      </Card>

      <FinanceSummaryCards summary={summary} isLoading={isLoading} />

      <Card>
        <CardHeader>
          <CardTitle>Window Activity Counters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <p className="text-sm text-muted-foreground">
            Trades: <span className="tabular-nums text-foreground">{counters.tradesCount}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Orders Placed:{" "}
            <span className="tabular-nums text-foreground">{counters.ordersPlacedCount}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Orders Cancelled:{" "}
            <span className="tabular-nums text-foreground">{counters.ordersCancelledCount}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Productions Completed:{" "}
            <span className="tabular-nums text-foreground">{counters.productionsCompletedCount}</span>
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <FinanceBreakdownTable summary={summary} isLoading={isLoading} />
        <FinanceReconciliationPanel company={company} latestLedgerEntry={latestLedgerEntry} />
      </div>

      <FinanceLedgerTable
        entries={ledgerEntries}
        isLoading={isLoading}
        hasPreviousPage={cursorHistory.length > 0}
        hasNextPage={Boolean(nextCursor)}
        onPreviousPage={onPreviousPage}
        onNextPage={onNextPage}
        onCopyText={(value, label) => {
          void copyText(value, label);
        }}
      />
    </div>
  );
}

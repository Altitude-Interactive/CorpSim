"use client";

import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompanyDetails, FinanceLedgerEntry } from "@/lib/api";
import { formatCents } from "@/lib/format";

interface FinanceReconciliationPanelProps {
  company: CompanyDetails | null;
  latestLedgerEntry: FinanceLedgerEntry | null;
}

function formatMaybe(value: string | null): string {
  if (value === null) {
    return "--";
  }
  return formatCents(value);
}

export function FinanceReconciliationPanel({
  company,
  latestLedgerEntry
}: FinanceReconciliationPanelProps) {
  const latestBalance = latestLedgerEntry?.balanceAfterCents ?? null;
  const mismatch =
    company !== null &&
    latestBalance !== null &&
    company.cashCents !== undefined &&
    BigInt(company.cashCents) !== BigInt(latestBalance);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reconciliation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Current cash balance</span>
          <span className="tabular-nums">{formatMaybe(company?.cashCents ?? null)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Current reserved cash</span>
          <span className="tabular-nums">{formatMaybe(company?.reservedCashCents ?? null)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Latest ledger balance</span>
          <span className="tabular-nums">{formatMaybe(latestBalance)}</span>
        </div>
        <div className="pt-1">
          {mismatch ? (
            <Badge variant="danger" className="inline-flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Balance mismatch detected
            </Badge>
          ) : (
            <Badge variant="success">Balances reconciled</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

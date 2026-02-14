"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableSkeletonRows } from "@/components/ui/table-skeleton-rows";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FinanceSummary } from "@/lib/api";
import { formatCents } from "@/lib/format";
import { formatCodeLabel } from "@/lib/ui-copy";

interface FinanceBreakdownTableProps {
  summary: FinanceSummary | null;
  isLoading: boolean;
}

export function FinanceBreakdownTable({ summary, isLoading }: FinanceBreakdownTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Breakdown by Transaction Category</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Transaction Category</TableHead>
              <TableHead>Count</TableHead>
              <TableHead>Cash Change</TableHead>
              <TableHead>Reserved Cash Change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (summary?.breakdownByEntryType.length ?? 0) === 0 ? (
              <TableSkeletonRows columns={4} />
            ) : null}
            {summary?.breakdownByEntryType.map((row) => (
              <TableRow key={row.entryType}>
                <TableCell className="text-xs">{formatCodeLabel(row.entryType)}</TableCell>
                <TableCell className="tabular-nums">{row.count.toLocaleString()}</TableCell>
                <TableCell className="tabular-nums">{formatCents(row.deltaCashCents)}</TableCell>
                <TableCell className="tabular-nums">{formatCents(row.deltaReservedCashCents)}</TableCell>
              </TableRow>
            ))}
            {!isLoading && (summary?.breakdownByEntryType.length ?? 0) === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No ledger activity in selected window.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FinanceSummary } from "@/lib/api";
import { formatCents } from "@/lib/format";

interface FinanceBreakdownTableProps {
  summary: FinanceSummary | null;
  isLoading: boolean;
}

export function FinanceBreakdownTable({ summary, isLoading }: FinanceBreakdownTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Breakdown by Entry Type</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entry Type</TableHead>
              <TableHead>Count</TableHead>
              <TableHead>Delta Cash</TableHead>
              <TableHead>Delta Reserved</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary?.breakdownByEntryType.map((row) => (
              <TableRow key={row.entryType}>
                <TableCell className="font-mono text-xs">{row.entryType}</TableCell>
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

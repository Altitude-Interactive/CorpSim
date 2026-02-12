"use client";

import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FinanceLedgerEntry } from "@/lib/api";
import { formatCents } from "@/lib/format";
import { UI_CADENCE_TERMS } from "@/lib/ui-terms";
import { formatCodeLabel, UI_COPY } from "@/lib/ui-copy";

interface FinanceLedgerTableProps {
  entries: FinanceLedgerEntry[];
  isLoading: boolean;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onCopyText: (value: string, label: string) => void;
}

export function FinanceLedgerTable({
  entries,
  isLoading,
  hasPreviousPage,
  hasNextPage,
  onPreviousPage,
  onNextPage,
  onCopyText
}: FinanceLedgerTableProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Ledger Entries</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onPreviousPage}
            disabled={!hasPreviousPage || isLoading}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onNextPage}
            disabled={!hasNextPage || isLoading}
          >
            Next
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{UI_CADENCE_TERMS.singularTitle}</TableHead>
              <TableHead>Transaction Category</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Cash Change</TableHead>
              <TableHead>Reserved Cash Change</TableHead>
              <TableHead>Balance After</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="tabular-nums">{entry.tick.toLocaleString()}</TableCell>
                <TableCell className="text-xs">{formatCodeLabel(entry.entryType)}</TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <p className="text-xs">{formatCodeLabel(entry.referenceType)}</p>
                    <div className="flex items-center gap-2">
                      <p className="truncate text-xs text-muted-foreground">
                        {UI_COPY.common.unknownReference}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onCopyText(entry.referenceId, "Reference")}
                        title="Copy reference"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="tabular-nums">{formatCents(entry.deltaCashCents)}</TableCell>
                <TableCell className="tabular-nums">{formatCents(entry.deltaReservedCashCents)}</TableCell>
                <TableCell className="tabular-nums">{formatCents(entry.balanceAfterCents)}</TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <p className="text-xs">{new Date(entry.createdAt).toLocaleString()}</p>
                    <div className="flex items-center gap-2">
                      <p className="truncate text-xs text-muted-foreground">
                        Ledger record available
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onCopyText(entry.id, "Ledger Record")}
                        title="Copy ledger record"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No ledger rows for current filters.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
        {isLoading ? <p className="mt-3 text-sm text-muted-foreground">Loading ledger...</p> : null}
      </CardContent>
    </Card>
  );
}

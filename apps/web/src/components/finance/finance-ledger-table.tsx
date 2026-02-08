"use client";

import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FinanceLedgerEntry } from "@/lib/api";
import { formatCents } from "@/lib/format";

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
              <TableHead>Tick</TableHead>
              <TableHead>Entry Type</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Delta Cash</TableHead>
              <TableHead>Delta Reserved</TableHead>
              <TableHead>Balance After</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="tabular-nums">{entry.tick.toLocaleString()}</TableCell>
                <TableCell className="font-mono text-xs">{entry.entryType}</TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <p className="font-mono text-xs">{entry.referenceType}</p>
                    <div className="flex items-center gap-2">
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {entry.referenceId}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onCopyText(entry.referenceId, "Reference ID")}
                        title="Copy reference ID"
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
                      <p className="truncate font-mono text-xs text-muted-foreground">{entry.id}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onCopyText(entry.id, "Ledger ID")}
                        title="Copy ledger ID"
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

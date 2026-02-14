"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ItemLabel } from "@/components/items/item-label";
import { TableSkeletonRows } from "@/components/ui/table-skeleton-rows";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ContractRecord } from "@/lib/api";
import { formatCents } from "@/lib/format";
import { UI_CADENCE_TERMS } from "@/lib/ui-terms";
import { formatCodeLabel } from "@/lib/ui-copy";

interface ContractsHistoryTableProps {
  contracts: ContractRecord[];
  isLoading: boolean;
}

export function ContractsHistoryTable({ contracts, isLoading }: ContractsHistoryTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>History</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Total Qty</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>{`Accepted ${UI_CADENCE_TERMS.singularTitle}`}</TableHead>
              <TableHead>{`Closed ${UI_CADENCE_TERMS.singularTitle}`}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && contracts.length === 0 ? <TableSkeletonRows columns={6} /> : null}
            {contracts.map((contract) => (
              <TableRow key={contract.id}>
                <TableCell>
                  <ItemLabel itemCode={contract.item.code} itemName={contract.item.name} />
                </TableCell>
                <TableCell className="text-xs">{formatCodeLabel(contract.status)}</TableCell>
                <TableCell className="tabular-nums">{contract.quantity}</TableCell>
                <TableCell className="tabular-nums">{formatCents(contract.priceCents)}</TableCell>
                <TableCell className="tabular-nums">{contract.tickAccepted ?? "-"}</TableCell>
                <TableCell className="tabular-nums">{contract.tickClosed ?? "-"}</TableCell>
              </TableRow>
            ))}
            {!isLoading && contracts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No contract history for current filters.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

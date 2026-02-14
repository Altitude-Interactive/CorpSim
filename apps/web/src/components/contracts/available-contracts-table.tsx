"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ItemLabel } from "@/components/items/item-label";
import { TableSkeletonRows } from "@/components/ui/table-skeleton-rows";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ContractRecord } from "@/lib/api";
import { formatCents } from "@/lib/format";
import { UI_CADENCE_TERMS } from "@/lib/ui-terms";

interface AvailableContractsTableProps {
  contracts: ContractRecord[];
  currentTick?: number;
  isLoading: boolean;
  isSubmittingContractId: string | null;
  onAccept: (contract: ContractRecord) => void;
}

function resolveTicksToExpiry(contract: ContractRecord, currentTick?: number): string {
  if (currentTick === undefined) {
    return String(contract.tickExpires);
  }

  return String(contract.tickExpires - currentTick);
}

export function AvailableContractsTable({
  contracts,
  currentTick,
  isLoading,
  isSubmittingContractId,
  onAccept
}: AvailableContractsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Available</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Buyer</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Remaining</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>{`Expires In (${UI_CADENCE_TERMS.plural})`}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && contracts.length === 0 ? <TableSkeletonRows columns={7} /> : null}
            {contracts.map((contract) => (
              <TableRow key={contract.id}>
                <TableCell>
                  <ItemLabel itemCode={contract.item.code} itemName={contract.item.name} />
                </TableCell>
                <TableCell>
                  <p>{contract.buyerCompany.name}</p>
                </TableCell>
                <TableCell className="tabular-nums">{contract.quantity}</TableCell>
                <TableCell className="tabular-nums">{contract.remainingQuantity}</TableCell>
                <TableCell className="tabular-nums">{formatCents(contract.priceCents)}</TableCell>
                <TableCell className="tabular-nums">{resolveTicksToExpiry(contract, currentTick)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    disabled={isSubmittingContractId === contract.id}
                    onClick={() => onAccept(contract)}
                  >
                    Accept
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && contracts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No open contracts for current filters.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

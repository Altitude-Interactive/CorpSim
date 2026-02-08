"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ContractRecord } from "@/lib/api";
import { formatCents } from "@/lib/format";

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
              <TableHead>Expires In (ticks)</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {contracts.map((contract) => (
              <TableRow key={contract.id}>
                <TableCell>
                  <p>{contract.item.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{contract.item.code}</p>
                </TableCell>
                <TableCell>
                  <p>{contract.buyerCompany.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{contract.buyerCompany.code}</p>
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
        {isLoading ? <p className="mt-3 text-sm text-muted-foreground">Loading contracts...</p> : null}
      </CardContent>
    </Card>
  );
}

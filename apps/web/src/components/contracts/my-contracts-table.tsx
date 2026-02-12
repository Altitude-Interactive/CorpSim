"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ContractRecord } from "@/lib/api";
import { formatCents } from "@/lib/format";
import { formatCodeLabel } from "@/lib/ui-copy";

interface MyContractsTableProps {
  contracts: ContractRecord[];
  isLoading: boolean;
  isSubmittingContractId: string | null;
  fulfillQuantityByContractId: Record<string, string>;
  onFulfillQuantityChange: (contractId: string, value: string) => void;
  onFulfill: (contract: ContractRecord) => void;
}

function progressPercent(contract: ContractRecord): number {
  if (contract.quantity <= 0) {
    return 0;
  }
  const fulfilled = contract.quantity - contract.remainingQuantity;
  const ratio = (fulfilled / contract.quantity) * 100;
  return Math.max(0, Math.min(100, ratio));
}

export function MyContractsTable({
  contracts,
  isLoading,
  isSubmittingContractId,
  fulfillQuantityByContractId,
  onFulfillQuantityChange,
  onFulfill
}: MyContractsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>My Contracts</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Fulfill Qty</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {contracts.map((contract) => {
              const percentage = progressPercent(contract);
              return (
                <TableRow key={contract.id}>
                  <TableCell>
                    <p>{contract.item.name}</p>
                  </TableCell>
                  <TableCell className="text-xs">{formatCodeLabel(contract.status)}</TableCell>
                  <TableCell>
                    <p className="mb-1 text-xs text-muted-foreground">
                      {contract.quantity - contract.remainingQuantity}/{contract.quantity}
                    </p>
                    <div className="h-2 w-full rounded bg-muted">
                      <div className="h-2 rounded bg-primary" style={{ width: `${percentage}%` }} />
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">{formatCents(contract.priceCents)}</TableCell>
                  <TableCell>
                    <Input
                      className="w-24"
                      value={
                        fulfillQuantityByContractId[contract.id] ?? String(contract.remainingQuantity)
                      }
                      onChange={(event) =>
                        onFulfillQuantityChange(contract.id, event.target.value)
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      disabled={isSubmittingContractId === contract.id}
                      onClick={() => onFulfill(contract)}
                    >
                      Fulfill
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {!isLoading && contracts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No accepted contracts for the active company.
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

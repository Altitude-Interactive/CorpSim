"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ItemLabel } from "@/components/items/item-label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const AVAILABLE_CONTRACT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

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
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] =
    useState<(typeof AVAILABLE_CONTRACT_PAGE_SIZE_OPTIONS)[number]>(20);
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);

  const indexedContracts = useMemo(
    () =>
      contracts.map((contract) => ({
        contract,
        searchText: `${contract.item.code} ${contract.item.name} ${contract.buyerCompany.name} ${contract.status}`.toLowerCase()
      })),
    [contracts]
  );

  const filteredContracts = useMemo(() => {
    const needle = deferredSearch.trim().toLowerCase();
    if (!needle) {
      return indexedContracts.map((entry) => entry.contract);
    }

    return indexedContracts
      .filter((entry) => entry.searchText.includes(needle))
      .map((entry) => entry.contract);
  }, [deferredSearch, indexedContracts]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredContracts.length / pageSize)),
    [filteredContracts.length, pageSize]
  );

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pagedContracts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredContracts.slice(start, start + pageSize);
  }, [filteredContracts, page, pageSize]);

  const rangeLabel = useMemo(() => {
    if (filteredContracts.length === 0) {
      return "0-0";
    }
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, filteredContracts.length);
    return `${start}-${end}`;
  }, [filteredContracts.length, page, pageSize]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Available</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by item, buyer, or status"
            className="w-full md:w-80"
          />
          <Select
            value={String(pageSize)}
            onValueChange={(value) =>
              setPageSize(
                Number.parseInt(value, 10) as (typeof AVAILABLE_CONTRACT_PAGE_SIZE_OPTIONS)[number]
              )
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Page size" />
            </SelectTrigger>
            <SelectContent>
              {AVAILABLE_CONTRACT_PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>
            Showing {rangeLabel} of {filteredContracts.length} rows ({contracts.length} total)
          </p>
          {deferredSearch !== search ? <p>Updating results...</p> : null}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <span className="tabular-nums">
              Page {page} / {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
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
            {isLoading && pagedContracts.length === 0 ? <TableSkeletonRows columns={7} /> : null}
            {pagedContracts.map((contract) => (
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
            {!isLoading && pagedContracts.length === 0 ? (
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

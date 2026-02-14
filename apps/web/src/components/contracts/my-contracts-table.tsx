"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ItemLabel } from "@/components/items/item-label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DeferredSearchStatus } from "@/components/ui/deferred-search-status";
import { TableFillerRows } from "@/components/ui/table-filler-rows";
import { TableSkeletonRows } from "@/components/ui/table-skeleton-rows";
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

const MY_CONTRACT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

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
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] =
    useState<(typeof MY_CONTRACT_PAGE_SIZE_OPTIONS)[number]>(20);
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);

  const indexedContracts = useMemo(
    () =>
      contracts.map((contract) => ({
        contract,
        searchText: `${contract.item.code} ${contract.item.name} ${contract.status}`.toLowerCase()
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
        <CardTitle>My Contracts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by item or status"
            className="w-full md:w-72"
          />
          <Select
            value={String(pageSize)}
            onValueChange={(value) =>
              setPageSize(
                Number.parseInt(value, 10) as (typeof MY_CONTRACT_PAGE_SIZE_OPTIONS)[number]
              )
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Page size" />
            </SelectTrigger>
            <SelectContent>
              {MY_CONTRACT_PAGE_SIZE_OPTIONS.map((size) => (
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
          <DeferredSearchStatus isUpdating={deferredSearch !== search} />
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
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Fulfill Qty</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && pagedContracts.length === 0 ? <TableSkeletonRows columns={6} /> : null}
            {pagedContracts.map((contract) => {
              const percentage = progressPercent(contract);
              return (
                <TableRow key={contract.id}>
                  <TableCell>
                    <ItemLabel itemCode={contract.item.code} itemName={contract.item.name} />
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
            {!isLoading && pagedContracts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No accepted contracts for the active company.
                </TableCell>
              </TableRow>
            ) : null}
            {!isLoading ? (
              <TableFillerRows
                columns={6}
                currentRows={Math.max(1, pagedContracts.length)}
                targetRows={pageSize}
              />
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

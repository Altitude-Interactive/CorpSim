"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useActiveCompany } from "@/components/company/active-company-provider";
import { ItemLabel } from "@/components/items/item-label";
import { useWorldHealth } from "@/components/layout/world-health-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DeferredSearchStatus } from "@/components/ui/deferred-search-status";
import { TableFillerRows } from "@/components/ui/table-filler-rows";
import { TableSkeletonRows } from "@/components/ui/table-skeleton-rows";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InventoryRow, RegionSummary, listCompanyInventory, listRegions } from "@/lib/api";
import { getRegionLabel, UI_COPY } from "@/lib/ui-copy";

const INVENTORY_REFRESH_DEBOUNCE_MS = 500;
const INVENTORY_PAGE_SIZE_OPTIONS = [20, 50, 100, 200] as const;

export function InventoryPage() {
  const { activeCompany, activeCompanyId } = useActiveCompany();
  const { health } = useWorldHealth();
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [regions, setRegions] = useState<RegionSummary[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<string>("");
  const [showReserved, setShowReserved] = useState(true);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState<(typeof INVENTORY_PAGE_SIZE_OPTIONS)[number]>(50);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedInventory, setHasLoadedInventory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);
  const hasLoadedInventoryRef = useRef(false);

  const loadInventory = useCallback(async (options?: { showLoadingState?: boolean }) => {
    const showLoadingState = options?.showLoadingState ?? !hasLoadedInventoryRef.current;
    if (!activeCompanyId) {
      setRows([]);
      if (showLoadingState) {
        setIsLoading(false);
      }
      if (!hasLoadedInventoryRef.current) {
        hasLoadedInventoryRef.current = true;
        setHasLoadedInventory(true);
      }
      return;
    }

    if (showLoadingState) {
      setIsLoading(true);
    }
    try {
      const regionId = selectedRegionId || activeCompany?.regionId;
      const nextRows = await listCompanyInventory(activeCompanyId, regionId);
      setRows(nextRows);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load inventory");
    } finally {
      if (showLoadingState) {
        setIsLoading(false);
      }
      if (!hasLoadedInventoryRef.current) {
        hasLoadedInventoryRef.current = true;
        setHasLoadedInventory(true);
      }
    }
  }, [activeCompanyId, activeCompany?.regionId, selectedRegionId]);

  useEffect(() => {
    let mounted = true;
    const loadRegions = async () => {
      try {
        const regionRows = await listRegions();
        if (!mounted) {
          return;
        }
        setRegions(regionRows);
      } catch {
        // Ignore region fetch failures here; inventory fallback still works.
      }
    };

    void loadRegions();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!activeCompany?.regionId) {
      setSelectedRegionId("");
      return;
    }

    setSelectedRegionId(activeCompany.regionId);
  }, [activeCompany?.regionId, activeCompanyId]);

  useEffect(() => {
    void loadInventory({ showLoadingState: !hasLoadedInventoryRef.current });
  }, [loadInventory]);

  useEffect(() => {
    const tick = health?.currentTick;
    if (tick === undefined || !activeCompanyId) {
      return;
    }

    const timeout = setTimeout(() => {
      void loadInventory({ showLoadingState: false });
    }, INVENTORY_REFRESH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [health?.currentTick, loadInventory, activeCompanyId]);

  const indexedRows = useMemo(
    () =>
      rows.map((row) => ({
        row,
        searchText: `${row.itemCode} ${row.itemName}`.toLowerCase()
      })),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const needle = deferredSearch.trim().toLowerCase();
    if (!needle) {
      return indexedRows.map((entry) => entry.row);
    }

    return indexedRows
      .filter((entry) => entry.searchText.includes(needle))
      .map((entry) => entry.row);
  }, [deferredSearch, indexedRows]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize, selectedRegionId, showReserved]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredRows.length / pageSize)),
    [filteredRows.length, pageSize]
  );

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  const rangeLabel = useMemo(() => {
    if (filteredRows.length === 0) {
      return "0-0";
    }

    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, filteredRows.length);
    return `${start}-${end}`;
  }, [filteredRows.length, page, pageSize]);
  const showInitialSkeleton = isLoading && !hasLoadedInventory;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Inventory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Active company:{" "}
            {activeCompany ? activeCompany.name : UI_COPY.common.noCompanySelected}
          </p>
          <div className="grid gap-3 md:grid-cols-[minmax(0,320px)_auto] md:items-center">
            <Input
              placeholder="Search item name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={selectedRegionId}
                onValueChange={(value) => setSelectedRegionId(value)}
                disabled={!activeCompanyId}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  {regions.map((region) => (
                    <SelectItem key={region.id} value={region.id}>
                      {getRegionLabel({ code: region.code, name: region.name })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={showReserved}
                  onChange={(event) => setShowReserved(event.target.checked)}
                />
                Show reserved
              </label>
            </div>
          </div>
          <DeferredSearchStatus
            isUpdating={deferredSearch !== search}
            text="Updating inventory search..."
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <p>
              Showing {rangeLabel} of {filteredRows.length} rows ({rows.length} total)
            </p>
            <div className="flex items-center gap-2">
              <Select
                value={String(pageSize)}
                onValueChange={(value) =>
                  setPageSize(
                    Number.parseInt(value, 10) as (typeof INVENTORY_PAGE_SIZE_OPTIONS)[number]
                  )
                }
              >
                <SelectTrigger className="h-8 w-32">
                  <SelectValue placeholder="Page size" />
                </SelectTrigger>
                <SelectContent>
                  {INVENTORY_PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size} / page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Quantity</TableHead>
                {showReserved ? <TableHead>Reserved</TableHead> : null}
                <TableHead>Available</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {showInitialSkeleton && pagedRows.length === 0 ? (
                <TableSkeletonRows columns={showReserved ? 4 : 3} />
              ) : null}
              {pagedRows.map((row) => {
                const available = row.quantity - row.reservedQuantity;
                return (
                  <TableRow key={row.itemId}>
                    <TableCell>
                      <ItemLabel itemCode={row.itemCode} itemName={row.itemName} />
                    </TableCell>
                    <TableCell className="tabular-nums">{row.quantity}</TableCell>
                    {showReserved ? (
                      <TableCell className="tabular-nums">{row.reservedQuantity}</TableCell>
                    ) : null}
                    <TableCell className="tabular-nums">{available}</TableCell>
                  </TableRow>
                );
              })}
              {!showInitialSkeleton && pagedRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={showReserved ? 4 : 3}
                    className="text-center text-muted-foreground"
                  >
                    No inventory rows for current filters.
                  </TableCell>
                </TableRow>
              ) : null}
              {!showInitialSkeleton ? (
                <TableFillerRows
                  columns={showReserved ? 4 : 3}
                  currentRows={Math.max(1, pagedRows.length)}
                  targetRows={pageSize}
                />
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

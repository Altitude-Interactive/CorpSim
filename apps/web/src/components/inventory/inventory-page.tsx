"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useActiveCompany } from "@/components/company/active-company-provider";
import { useWorldHealth } from "@/components/layout/world-health-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InventoryRow, listCompanyInventory } from "@/lib/api";

const INVENTORY_REFRESH_DEBOUNCE_MS = 500;

export function InventoryPage() {
  const { activeCompany, activeCompanyId } = useActiveCompany();
  const { health } = useWorldHealth();
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [showReserved, setShowReserved] = useState(true);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInventory = useCallback(async () => {
    if (!activeCompanyId) {
      setRows([]);
      return;
    }

    setIsLoading(true);
    try {
      const nextRows = await listCompanyInventory(activeCompanyId);
      setRows(nextRows);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load inventory");
    } finally {
      setIsLoading(false);
    }
  }, [activeCompanyId]);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  useEffect(() => {
    const tick = health?.currentTick;
    if (tick === undefined || !activeCompanyId) {
      return;
    }

    const timeout = setTimeout(() => {
      void loadInventory();
    }, INVENTORY_REFRESH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [health?.currentTick, loadInventory, activeCompanyId]);

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return rows;
    }

    return rows.filter((row) => {
      return (
        row.itemCode.toLowerCase().includes(needle) || row.itemName.toLowerCase().includes(needle)
      );
    });
  }, [rows, search]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Inventory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Active company:{" "}
            {activeCompany ? `${activeCompany.code} - ${activeCompany.name}` : "No company selected"}
          </p>
          <div className="grid gap-3 md:grid-cols-[minmax(0,320px)_auto] md:items-center">
            <Input
              placeholder="Search item code or name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={showReserved}
                onChange={(event) => setShowReserved(event.target.checked)}
              />
              Show reserved
            </label>
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
                <TableHead>Code</TableHead>
                <TableHead>Quantity</TableHead>
                {showReserved ? <TableHead>Reserved</TableHead> : null}
                <TableHead>Available</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => {
                const available = row.quantity - row.reservedQuantity;
                return (
                  <TableRow key={row.itemId}>
                    <TableCell>{row.itemName}</TableCell>
                    <TableCell className="font-mono text-xs">{row.itemCode}</TableCell>
                    <TableCell className="tabular-nums">{row.quantity}</TableCell>
                    {showReserved ? (
                      <TableCell className="tabular-nums">{row.reservedQuantity}</TableCell>
                    ) : null}
                    <TableCell className="tabular-nums">{available}</TableCell>
                  </TableRow>
                );
              })}
              {!isLoading && filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={showReserved ? 5 : 4}
                    className="text-center text-muted-foreground"
                  >
                    No inventory rows for current filters.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          {isLoading ? <p className="mt-3 text-sm text-muted-foreground">Loading inventory...</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useActiveCompany } from "@/components/company/active-company-provider";
import { ItemLabel } from "@/components/items/item-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToastOverlay } from "@/components/ui/toast-manager";
import { InventoryRow, listCompanyInventory } from "@/lib/api";
import { getRegionLabel, UI_COPY } from "@/lib/ui-copy";
import { useControlShortcut } from "./control-manager";

const INVENTORY_PREVIEW_LIMIT = 12;

interface InventoryPreviewRow {
  row: InventoryRow;
  available: number;
}

export function InventoryPreviewShortcut() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeCompany, activeCompanyId } = useActiveCompany();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInventory = useCallback(async () => {
    if (!activeCompanyId) {
      setRows([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    try {
      const nextRows = await listCompanyInventory(activeCompanyId, activeCompany?.regionId);
      setRows(nextRows);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load inventory");
    } finally {
      setIsLoading(false);
    }
  }, [activeCompany?.regionId, activeCompanyId]);

  const shortcut = useMemo(
    () => ({
      id: "inventory-preview-open",
      key: "i",
      modifier: "ctrlOrMeta" as const,
      allowWhenTyping: true,
      preventDefault: true,
      onTrigger: () => {
        setOpen((previous) => !previous);
      }
    }),
    []
  );

  useControlShortcut(shortcut);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSearch("");
    void loadInventory();
  }, [open, loadInventory]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  const filteredRows = useMemo<InventoryPreviewRow[]>(() => {
    const needle = search.trim().toLowerCase();

    return rows
      .filter((row) => {
        if (!needle) {
          return true;
        }
        return `${row.itemCode} ${row.itemName}`.toLowerCase().includes(needle);
      })
      .map((row) => ({
        row,
        available: row.quantity - row.reservedQuantity
      }))
      .sort((left, right) => {
        if (right.available !== left.available) {
          return right.available - left.available;
        }
        if (right.row.quantity !== left.row.quantity) {
          return right.row.quantity - left.row.quantity;
        }
        return left.row.itemName.localeCompare(right.row.itemName);
      });
  }, [rows, search]);

  const previewRows = filteredRows.slice(0, INVENTORY_PREVIEW_LIMIT);
  const hiddenRowsCount = Math.max(0, filteredRows.length - previewRows.length);

  if (!open) {
    return null;
  }

  return (
    <ToastOverlay
      backdrop="solid"
      variant="default"
      layerClassName="z-[9700] p-4 sm:p-8"
      panelClassName="max-w-3xl p-0"
      onBackdropMouseDown={() => setOpen(false)}
      labelledBy="inventory-preview-title"
      describedBy="inventory-preview-description"
    >
      <header className="border-b border-border px-4 py-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Quick Preview</p>
        <h2 id="inventory-preview-title" className="mt-1 text-lg font-semibold text-slate-100">
          Inventory Snapshot
        </h2>
        <p id="inventory-preview-description" className="mt-1 text-sm text-slate-300">
          {activeCompany
            ? `${activeCompany.name} · ${getRegionLabel({
                code: activeCompany.regionCode,
                name: activeCompany.regionName
              })}`
            : UI_COPY.common.selectCompanyFirst}
        </p>
      </header>

      <div className="space-y-3 px-4 py-4">
        <Input
          placeholder="Search inventory..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          disabled={!activeCompanyId}
        />

        {!activeCompanyId ? (
          <p className="text-sm text-slate-300">{UI_COPY.common.selectCompanyFirst}</p>
        ) : null}

        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        {isLoading ? <p className="text-sm text-slate-300">Loading inventory...</p> : null}

        {!isLoading && activeCompanyId ? (
          <div className="max-h-[48vh] overflow-auto rounded-md border border-border/80">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Reserved</TableHead>
                  <TableHead>Available</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map(({ row, available }) => (
                  <TableRow key={row.itemId}>
                    <TableCell>
                      <ItemLabel itemCode={row.itemCode} itemName={row.itemName} />
                    </TableCell>
                    <TableCell className="tabular-nums">{row.quantity}</TableCell>
                    <TableCell className="tabular-nums">{row.reservedQuantity}</TableCell>
                    <TableCell className="tabular-nums">{available}</TableCell>
                  </TableRow>
                ))}
                {previewRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No inventory rows found.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-xs text-slate-300">
        <p>
          {hiddenRowsCount > 0
            ? `Showing ${INVENTORY_PREVIEW_LIMIT} of ${filteredRows.length} items`
            : `${filteredRows.length} item${filteredRows.length === 1 ? "" : "s"} shown`}
        </p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setOpen(false);
              router.push("/inventory");
            }}
          >
            Open Inventory
          </Button>
        </div>
      </footer>
    </ToastOverlay>
  );
}

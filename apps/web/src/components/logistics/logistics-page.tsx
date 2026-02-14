"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useActiveCompany } from "@/components/company/active-company-provider";
import { ItemLabel } from "@/components/items/item-label";
import { useWorldHealth } from "@/components/layout/world-health-provider";
import { useUiSfx } from "@/components/layout/ui-sfx-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableFillerRows } from "@/components/ui/table-filler-rows";
import { TableSkeletonRows } from "@/components/ui/table-skeleton-rows";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast-manager";
import {
  InventoryRow,
  ItemCatalogItem,
  MarketAnalyticsSummary,
  RegionSummary,
  ShipmentRecord,
  cancelShipment,
  createShipment,
  getMarketAnalyticsSummary,
  listCompanyInventory,
  listItems,
  listProductionRecipes,
  listRegions,
  listShipments
} from "@/lib/api";
import { formatCents } from "@/lib/format";
import { UI_CADENCE_TERMS } from "@/lib/ui-terms";
import { formatCodeLabel, getRegionLabel, UI_COPY } from "@/lib/ui-copy";

const SHIPMENT_REFRESH_DEBOUNCE_MS = 600;
const SHIPMENT_BASE_FEE_CENTS = Number.parseInt(
  process.env.NEXT_PUBLIC_SHIPMENT_BASE_FEE_CENTS ?? "250",
  10
);
const SHIPMENT_FEE_PER_UNIT_CENTS = Number.parseInt(
  process.env.NEXT_PUBLIC_SHIPMENT_FEE_PER_UNIT_CENTS ?? "15",
  10
);
const SHIPMENT_TABLE_PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
const LOGISTICS_ITEM_SELECT_LIMIT = 200;

const TRAVEL_TICKS_BY_REGION_PAIR = new Map<string, number>([
  ["CORE:INDUSTRIAL", 5],
  ["CORE:FRONTIER", 10],
  ["FRONTIER:INDUSTRIAL", 7]
]);

function pairKey(leftCode: string, rightCode: string): string {
  return [leftCode, rightCode].sort((a, b) => a.localeCompare(b)).join(":");
}

function resolveTravelTicks(fromCode: string, toCode: string): number | null {
  if (fromCode === toCode) {
    return null;
  }
  return TRAVEL_TICKS_BY_REGION_PAIR.get(pairKey(fromCode, toCode)) ?? null;
}

function estimateShipmentFeeCents(quantity: number): number {
  return SHIPMENT_BASE_FEE_CENTS + SHIPMENT_FEE_PER_UNIT_CENTS * quantity;
}

export function LogisticsPage() {
  const { showToast, confirmPopup } = useToast();
  const { play } = useUiSfx();
  const { activeCompany, activeCompanyId } = useActiveCompany();
  const { health } = useWorldHealth();
  const [regions, setRegions] = useState<RegionSummary[]>([]);
  const [items, setItems] = useState<ItemCatalogItem[]>([]);
  const [shipments, setShipments] = useState<ShipmentRecord[]>([]);
  const [toRegionId, setToRegionId] = useState<string>("");
  const [itemId, setItemId] = useState<string>("");
  const [itemSearch, setItemSearch] = useState("");
  const [quantityInput, setQuantityInput] = useState("1");
  const [inTransitPageSize, setInTransitPageSize] =
    useState<(typeof SHIPMENT_TABLE_PAGE_SIZE_OPTIONS)[number]>(20);
  const [inTransitPage, setInTransitPage] = useState(1);
  const [deliveredPageSize, setDeliveredPageSize] =
    useState<(typeof SHIPMENT_TABLE_PAGE_SIZE_OPTIONS)[number]>(20);
  const [deliveredPage, setDeliveredPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedShipments, setHasLoadedShipments] = useState(false);
  const [isLoadingArbitrage, setIsLoadingArbitrage] = useState(false);
  const [hasLoadedArbitrage, setHasLoadedArbitrage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyticsByRegion, setAnalyticsByRegion] = useState<Record<string, MarketAnalyticsSummary | null>>({});
  const deliveredIdsRef = useRef<Set<string>>(new Set());
  const didPrimeDeliveredRef = useRef(false);
  const hasLoadedShipmentsRef = useRef(false);
  const hasLoadedArbitrageRef = useRef(false);
  const deferredItemSearch = useDeferredValue(itemSearch);

  const loadCatalog = useCallback(async () => {
    try {
      const [regionRows, itemRows] = await Promise.all([listRegions(), listItems()]);
      const [unlockedRecipes, inventoryRows] = activeCompanyId
        ? await Promise.all([
            listProductionRecipes(activeCompanyId),
            listCompanyInventory(activeCompanyId)
          ])
        : [[], [] as InventoryRow[]];

      const selectableItemIds = new Set<string>();
      for (const recipe of unlockedRecipes) {
        selectableItemIds.add(recipe.outputItem.id);
        for (const input of recipe.inputs) {
          selectableItemIds.add(input.itemId);
        }
      }
      for (const row of inventoryRows) {
        selectableItemIds.add(row.itemId);
      }

      const filteredItems =
        selectableItemIds.size === 0
          ? itemRows
          : itemRows.filter((item) => selectableItemIds.has(item.id));

      setRegions(regionRows);
      setItems(filteredItems);
      setToRegionId((current) => {
        if (current && regionRows.some((region) => region.id === current)) {
          return current;
        }

        const firstNonHome = regionRows.find((region) => region.id !== activeCompany?.regionId);
        return firstNonHome?.id ?? regionRows[0]?.id ?? "";
      });
      setItemId((current) => {
        if (current && filteredItems.some((item) => item.id === current)) {
          return current;
        }
        return filteredItems[0]?.id ?? "";
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load logistics catalog");
    }
  }, [activeCompany?.regionId, activeCompanyId]);

  const loadShipments = useCallback(async (options?: { showLoadingState?: boolean }) => {
    const showLoadingState = options?.showLoadingState ?? !hasLoadedShipmentsRef.current;
    if (!activeCompanyId) {
      setShipments([]);
      if (showLoadingState) {
        setIsLoading(false);
      }
      if (!hasLoadedShipmentsRef.current) {
        hasLoadedShipmentsRef.current = true;
        setHasLoadedShipments(true);
      }
      return;
    }

    if (showLoadingState) {
      setIsLoading(true);
    }
    try {
      const rows = await listShipments({
        companyId: activeCompanyId,
        limit: 200
      });
      setShipments(rows);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load shipments");
    } finally {
      if (showLoadingState) {
        setIsLoading(false);
      }
      if (!hasLoadedShipmentsRef.current) {
        hasLoadedShipmentsRef.current = true;
        setHasLoadedShipments(true);
      }
    }
  }, [activeCompanyId]);

  const loadArbitrage = useCallback(async (options?: { showLoadingState?: boolean }) => {
    const showLoadingState = options?.showLoadingState ?? !hasLoadedArbitrageRef.current;
    if (!itemId || regions.length === 0) {
      setAnalyticsByRegion({});
      if (showLoadingState) {
        setIsLoadingArbitrage(false);
      }
      if (!hasLoadedArbitrageRef.current) {
        hasLoadedArbitrageRef.current = true;
        setHasLoadedArbitrage(true);
      }
      return;
    }

    if (showLoadingState) {
      setIsLoadingArbitrage(true);
    }
    try {
      const entries = await Promise.all(
        regions.map(async (region) => {
          try {
            const summary = await getMarketAnalyticsSummary(itemId, region.id, 200);
            return [region.id, summary] as const;
          } catch {
            return [region.id, null] as const;
          }
        })
      );
      setAnalyticsByRegion(Object.fromEntries(entries));
    } finally {
      if (showLoadingState) {
        setIsLoadingArbitrage(false);
      }
      if (!hasLoadedArbitrageRef.current) {
        hasLoadedArbitrageRef.current = true;
        setHasLoadedArbitrage(true);
      }
    }
  }, [itemId, regions]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    void loadShipments({ showLoadingState: !hasLoadedShipmentsRef.current });
  }, [loadShipments]);

  useEffect(() => {
    void loadArbitrage({ showLoadingState: !hasLoadedArbitrageRef.current });
  }, [loadArbitrage]);

  useEffect(() => {
    const tick = health?.currentTick;
    if (tick === undefined || !activeCompanyId) {
      return;
    }

    const timeout = setTimeout(() => {
      void loadShipments({ showLoadingState: false });
    }, SHIPMENT_REFRESH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [health?.currentTick, activeCompanyId, loadShipments]);

  useEffect(() => {
    const tick = health?.currentTick;
    if (tick === undefined) {
      return;
    }
    const timeout = setTimeout(() => {
      void loadArbitrage({ showLoadingState: false });
    }, SHIPMENT_REFRESH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [health?.currentTick, loadArbitrage]);

  useEffect(() => {
    deliveredIdsRef.current = new Set();
    didPrimeDeliveredRef.current = false;
  }, [activeCompanyId]);

  const selectedToRegion = useMemo(
    () => regions.find((region) => region.id === toRegionId) ?? null,
    [regions, toRegionId]
  );

  const selectedItem = useMemo(
    () => items.find((item) => item.id === itemId) ?? null,
    [items, itemId]
  );
  const sourceRegion = useMemo(
    () => regions.find((region) => region.id === activeCompany?.regionId) ?? null,
    [activeCompany?.regionId, regions]
  );
  const sourceRegionLabel = sourceRegion
    ? getRegionLabel({
      code: sourceRegion.code,
      name: sourceRegion.name
    })
    : "--";
  const selectedToRegionLabel = selectedToRegion
    ? getRegionLabel({
      code: selectedToRegion.code,
      name: selectedToRegion.name
    })
    : "--";

  const quantity = Number.parseInt(quantityInput, 10);
  const travelTicks =
    activeCompany?.regionCode && selectedToRegion
      ? resolveTravelTicks(activeCompany.regionCode, selectedToRegion.code)
      : null;
  const feeCents = Number.isInteger(quantity) && quantity > 0 ? estimateShipmentFeeCents(quantity) : null;
  const arrivalTick =
    health?.currentTick !== undefined && travelTicks !== null ? health.currentTick + travelTicks : null;

  const inTransit = shipments.filter((shipment) => shipment.status === "IN_TRANSIT");
  const delivered = shipments.filter((shipment) => shipment.status !== "IN_TRANSIT");

  useEffect(() => {
    setInTransitPage(1);
  }, [inTransitPageSize, shipments.length]);

  useEffect(() => {
    setDeliveredPage(1);
  }, [deliveredPageSize, shipments.length]);

  const inTransitTotalPages = useMemo(
    () => Math.max(1, Math.ceil(inTransit.length / inTransitPageSize)),
    [inTransit.length, inTransitPageSize]
  );
  const deliveredTotalPages = useMemo(
    () => Math.max(1, Math.ceil(delivered.length / deliveredPageSize)),
    [delivered.length, deliveredPageSize]
  );

  useEffect(() => {
    if (inTransitPage > inTransitTotalPages) {
      setInTransitPage(inTransitTotalPages);
    }
  }, [inTransitPage, inTransitTotalPages]);
  useEffect(() => {
    if (deliveredPage > deliveredTotalPages) {
      setDeliveredPage(deliveredTotalPages);
    }
  }, [deliveredPage, deliveredTotalPages]);

  const pagedInTransit = useMemo(() => {
    const start = (inTransitPage - 1) * inTransitPageSize;
    return inTransit.slice(start, start + inTransitPageSize);
  }, [inTransit, inTransitPage, inTransitPageSize]);
  const pagedDelivered = useMemo(() => {
    const start = (deliveredPage - 1) * deliveredPageSize;
    return delivered.slice(start, start + deliveredPageSize);
  }, [delivered, deliveredPage, deliveredPageSize]);

  const sortedItems = useMemo(
    () => [...items].sort((left, right) => left.name.localeCompare(right.name)),
    [items]
  );
  const filteredItemOptions = useMemo(() => {
    const needle = deferredItemSearch.trim().toLowerCase();
    if (!needle) {
      return sortedItems;
    }
    return sortedItems.filter((item) => `${item.code} ${item.name}`.toLowerCase().includes(needle));
  }, [deferredItemSearch, sortedItems]);
  const visibleItemOptions = useMemo(() => {
    const selected = sortedItems.find((item) => item.id === itemId) ?? null;
    const head = filteredItemOptions.slice(0, LOGISTICS_ITEM_SELECT_LIMIT);
    if (!selected || head.some((item) => item.id === selected.id)) {
      return head;
    }
    return [selected, ...head.slice(0, LOGISTICS_ITEM_SELECT_LIMIT - 1)];
  }, [filteredItemOptions, itemId, sortedItems]);

  useEffect(() => {
    const deliveredIds = new Set(
      delivered
        .filter((shipment) => shipment.status === "DELIVERED")
        .map((shipment) => shipment.id)
    );
    if (!didPrimeDeliveredRef.current) {
      deliveredIdsRef.current = deliveredIds;
      didPrimeDeliveredRef.current = true;
      return;
    }

    let hasNewArrival = false;
    for (const shipmentId of deliveredIds) {
      if (!deliveredIdsRef.current.has(shipmentId)) {
        hasNewArrival = true;
        break;
      }
    }
    if (hasNewArrival) {
      play("event_shipment_arrived");
    }
    deliveredIdsRef.current = deliveredIds;
  }, [delivered, play]);
  const sourcePriceCents = sourceRegion ? analyticsByRegion[sourceRegion.id]?.lastPriceCents ?? null : null;
  const destinationPriceCents = selectedToRegion
    ? analyticsByRegion[selectedToRegion.id]?.lastPriceCents ?? null
    : null;

  const routeSpreadPerUnitCents =
    sourcePriceCents !== null && destinationPriceCents !== null
      ? BigInt(destinationPriceCents) - BigInt(sourcePriceCents)
      : null;
  const routeGrossSpreadCents =
    routeSpreadPerUnitCents !== null && Number.isInteger(quantity) && quantity > 0
      ? routeSpreadPerUnitCents * BigInt(quantity)
      : null;
  const routeNetSpreadCents =
    routeGrossSpreadCents !== null && feeCents !== null
      ? routeGrossSpreadCents - BigInt(feeCents)
      : null;
  const showInitialShipmentsSkeleton = isLoading && !hasLoadedShipments;
  const showInitialArbitrageSkeleton = isLoadingArbitrage && !hasLoadedArbitrage;

  const arbitrageRows = regions
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((region) => {
      const lastPriceCents = analyticsByRegion[region.id]?.lastPriceCents ?? null;
      const deltaVsSourceCents =
        sourcePriceCents !== null && lastPriceCents !== null
          ? BigInt(lastPriceCents) - BigInt(sourcePriceCents)
          : null;

      return {
        region,
        lastPriceCents,
        deltaVsSourceCents
      };
    });

  const handleCreateShipment = async () => {
    if (!activeCompanyId || !activeCompany) {
      setError(UI_COPY.common.selectCompanyFirst);
      return;
    }
    if (!toRegionId || !itemId) {
      setError("Select destination region and item.");
      return;
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setError("Quantity must be a positive integer.");
      return;
    }
    if (travelTicks === null || arrivalTick === null || feeCents === null) {
      setError("Invalid route. Choose a different destination region.");
      return;
    }

    play("ui_open");
    const confirmed = await confirmPopup({
      title: "Confirm shipment",
      description: `Ship ${quantity} units to ${selectedToRegionLabel} for ${formatCents(
        String(feeCents)
      )}. ETA ${UI_CADENCE_TERMS.singular.toLowerCase()} ${arrivalTick}.`,
      confirmLabel: "Create shipment",
      cancelLabel: "Cancel",
      backdrop: "solid"
    });
    if (!confirmed) {
      return;
    }

    setIsSubmitting(true);
    try {
      await createShipment({
        companyId: activeCompanyId,
        toRegionId,
        itemId,
        quantity
      });
      setError(null);
      showToast({
        title: "Shipment created",
        description: `Arrives at ${UI_CADENCE_TERMS.singular.toLowerCase()} ${arrivalTick}.`,
        variant: "success"
      });
      await loadShipments();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Failed to create shipment";
      setError(message);
      showToast({
        title: "Shipment failed",
        description: message,
        variant: "error"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelShipment = async (shipmentId: string) => {
    setIsSubmitting(true);
    try {
      await cancelShipment(shipmentId);
      showToast({
        title: "Shipment cancelled",
        description: "In-transit goods were returned to source region.",
        variant: "success"
      });
      await loadShipments();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Failed to cancel shipment";
      setError(message);
      showToast({
        title: "Cancel failed",
        description: message,
        variant: "error"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Create Shipment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Source region: {activeCompany ? sourceRegionLabel : "--"}
          </p>
          <div className="grid gap-3 md:grid-cols-4">
            <Select value={toRegionId} onValueChange={setToRegionId}>
              <SelectTrigger>
                <SelectValue placeholder="Destination region" />
              </SelectTrigger>
              <SelectContent>
                {regions
                  .filter((region) => region.id !== activeCompany?.regionId)
                  .map((region) => (
                    <SelectItem key={region.id} value={region.id}>
                      {getRegionLabel({ code: region.code, name: region.name })}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <div className="space-y-2">
              <Input
                value={itemSearch}
                onChange={(event) => setItemSearch(event.target.value)}
                placeholder="Search item"
              />
              <Select value={itemId} onValueChange={setItemId}>
                <SelectTrigger>
                  <SelectValue placeholder="Item" />
                </SelectTrigger>
                <SelectContent>
                  {visibleItemOptions.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      <ItemLabel itemCode={item.code} itemName={item.name} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filteredItemOptions.length > visibleItemOptions.length ? (
                <p className="text-xs text-muted-foreground">
                  Showing first {visibleItemOptions.length} matching items in dropdown.
                </p>
              ) : null}
            </div>
            <Input
              value={quantityInput}
              onChange={(event) => setQuantityInput(event.target.value)}
              placeholder="Quantity"
            />
            <Button onClick={() => void handleCreateShipment()} disabled={isSubmitting}>
              Create Shipment
            </Button>
          </div>
          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
            <p>
              Estimated fee: {feeCents === null ? "--" : formatCents(String(feeCents))}
            </p>
            <p>{`Estimated arrival ${UI_CADENCE_TERMS.singular.toLowerCase()}: ${arrivalTick ?? "--"}`}</p>
            {selectedItem ? (
              <p className="inline-flex items-center gap-1">
                <span>Item:</span>
                <ItemLabel itemCode={selectedItem.code} itemName={selectedItem.name} />
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void Promise.all([loadShipments(), loadArbitrage()]);
            }}
            disabled={isLoading || isLoadingArbitrage || isSubmitting}
          >
            Refresh Logistics Data
          </Button>
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Route Margin Analysis</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="mb-3 grid gap-2 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground md:grid-cols-2">
            <p>
              Route: {sourceRegionLabel} {"->"} {selectedToRegionLabel}
            </p>
            <p>
              Source last price: {sourcePriceCents ? formatCents(sourcePriceCents) : "--"}
            </p>
            <p>
              Destination last price: {destinationPriceCents ? formatCents(destinationPriceCents) : "--"}
            </p>
            <p>
              Unit margin (destination - source):{" "}
              {routeSpreadPerUnitCents !== null ? formatCents(routeSpreadPerUnitCents.toString()) : "--"}
            </p>
            <p>
              Net spread for qty {Number.isInteger(quantity) && quantity > 0 ? quantity : "--"}:{" "}
              {routeNetSpreadCents !== null ? formatCents(routeNetSpreadCents.toString()) : "--"}
            </p>
            <p>Net spread includes estimated shipping fee.</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Region</TableHead>
                <TableHead>Last Price</TableHead>
                <TableHead>Margin vs Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {showInitialArbitrageSkeleton && arbitrageRows.length === 0 ? <TableSkeletonRows columns={3} /> : null}
              {arbitrageRows.map((row) => {
                return (
                  <TableRow key={row.region.id}>
                    <TableCell>{getRegionLabel({ code: row.region.code, name: row.region.name })}</TableCell>
                    <TableCell className="tabular-nums">
                      {row.lastPriceCents ? formatCents(row.lastPriceCents) : "--"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {row.deltaVsSourceCents !== null
                        ? formatCents(row.deltaVsSourceCents.toString())
                        : "--"}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!showInitialArbitrageSkeleton && arbitrageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No regions available.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>In Transit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <p>
              Showing {pagedInTransit.length === 0 ? "0-0" : `${(inTransitPage - 1) * inTransitPageSize + 1}-${Math.min(inTransitPage * inTransitPageSize, inTransit.length)}`} of {inTransit.length}
            </p>
            <div className="flex items-center gap-2">
              <Select
                value={String(inTransitPageSize)}
                onValueChange={(value) =>
                  setInTransitPageSize(
                    Number.parseInt(value, 10) as (typeof SHIPMENT_TABLE_PAGE_SIZE_OPTIONS)[number]
                  )
                }
              >
                <SelectTrigger className="h-8 w-32">
                  <SelectValue placeholder="Page size" />
                </SelectTrigger>
                <SelectContent>
                  {SHIPMENT_TABLE_PAGE_SIZE_OPTIONS.map((size) => (
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
                onClick={() => setInTransitPage((page) => Math.max(1, page - 1))}
                disabled={inTransitPage <= 1}
              >
                Previous
              </Button>
              <span className="tabular-nums">
                Page {inTransitPage} / {inTransitTotalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setInTransitPage((page) => Math.min(inTransitTotalPages, page + 1))}
                disabled={inTransitPage >= inTransitTotalPages}
              >
                Next
              </Button>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>{`ETA ${UI_CADENCE_TERMS.singularTitle}`}</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {showInitialShipmentsSkeleton && pagedInTransit.length === 0 ? <TableSkeletonRows columns={5} /> : null}
              {pagedInTransit.map((shipment) => (
                <TableRow key={shipment.id}>
                  <TableCell>
                    <ItemLabel itemCode={shipment.item.code} itemName={shipment.item.name} />
                  </TableCell>
                  <TableCell>
                    {`${getRegionLabel({ code: shipment.fromRegion.code, name: shipment.fromRegion.name })} -> ${getRegionLabel({ code: shipment.toRegion.code, name: shipment.toRegion.name })}`}
                  </TableCell>
                  <TableCell className="tabular-nums">{shipment.quantity}</TableCell>
                  <TableCell className="tabular-nums">{shipment.tickArrives}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleCancelShipment(shipment.id)}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!showInitialShipmentsSkeleton && pagedInTransit.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No shipments in transit.
                  </TableCell>
                </TableRow>
              ) : null}
              {!showInitialShipmentsSkeleton ? (
                <TableFillerRows
                  columns={5}
                  currentRows={Math.max(1, pagedInTransit.length)}
                  targetRows={inTransitPageSize}
                />
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delivered / Cancelled</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <p>
              Showing {pagedDelivered.length === 0 ? "0-0" : `${(deliveredPage - 1) * deliveredPageSize + 1}-${Math.min(deliveredPage * deliveredPageSize, delivered.length)}`} of {delivered.length}
            </p>
            <div className="flex items-center gap-2">
              <Select
                value={String(deliveredPageSize)}
                onValueChange={(value) =>
                  setDeliveredPageSize(
                    Number.parseInt(value, 10) as (typeof SHIPMENT_TABLE_PAGE_SIZE_OPTIONS)[number]
                  )
                }
              >
                <SelectTrigger className="h-8 w-32">
                  <SelectValue placeholder="Page size" />
                </SelectTrigger>
                <SelectContent>
                  {SHIPMENT_TABLE_PAGE_SIZE_OPTIONS.map((size) => (
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
                onClick={() => setDeliveredPage((page) => Math.max(1, page - 1))}
                disabled={deliveredPage <= 1}
              >
                Previous
              </Button>
              <span className="tabular-nums">
                Page {deliveredPage} / {deliveredTotalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeliveredPage((page) => Math.min(deliveredTotalPages, page + 1))}
                disabled={deliveredPage >= deliveredTotalPages}
              >
                Next
              </Button>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>{`Created ${UI_CADENCE_TERMS.singularTitle}`}</TableHead>
                <TableHead>{`Closed ${UI_CADENCE_TERMS.singularTitle}`}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {showInitialShipmentsSkeleton && pagedDelivered.length === 0 ? <TableSkeletonRows columns={5} /> : null}
              {pagedDelivered.map((shipment) => (
                <TableRow key={shipment.id}>
                  <TableCell>
                    <ItemLabel itemCode={shipment.item.code} itemName={shipment.item.name} />
                  </TableCell>
                  <TableCell>
                    {`${getRegionLabel({ code: shipment.fromRegion.code, name: shipment.fromRegion.name })} -> ${getRegionLabel({ code: shipment.toRegion.code, name: shipment.toRegion.name })}`}
                  </TableCell>
                  <TableCell>{formatCodeLabel(shipment.status)}</TableCell>
                  <TableCell className="tabular-nums">{shipment.tickCreated}</TableCell>
                  <TableCell className="tabular-nums">{shipment.tickClosed ?? "--"}</TableCell>
                </TableRow>
              ))}
              {!showInitialShipmentsSkeleton && pagedDelivered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No shipment history yet.
                  </TableCell>
                </TableRow>
              ) : null}
              {!showInitialShipmentsSkeleton ? (
                <TableFillerRows
                  columns={5}
                  currentRows={Math.max(1, pagedDelivered.length)}
                  targetRows={deliveredPageSize}
                />
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}


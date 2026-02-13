"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useActiveCompany } from "@/components/company/active-company-provider";
import { ItemLabel } from "@/components/items/item-label";
import { useWorldHealth } from "@/components/layout/world-health-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import {
  ItemCatalogItem,
  MarketAnalyticsSummary,
  RegionSummary,
  ShipmentRecord,
  cancelShipment,
  createShipment,
  getMarketAnalyticsSummary,
  listItems,
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
  const { showToast } = useToast();
  const { activeCompany, activeCompanyId } = useActiveCompany();
  const { health } = useWorldHealth();
  const [regions, setRegions] = useState<RegionSummary[]>([]);
  const [items, setItems] = useState<ItemCatalogItem[]>([]);
  const [shipments, setShipments] = useState<ShipmentRecord[]>([]);
  const [toRegionId, setToRegionId] = useState<string>("");
  const [itemId, setItemId] = useState<string>("");
  const [quantityInput, setQuantityInput] = useState("1");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingArbitrage, setIsLoadingArbitrage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyticsByRegion, setAnalyticsByRegion] = useState<Record<string, MarketAnalyticsSummary | null>>({});

  const loadCatalog = useCallback(async () => {
    try {
      const [regionRows, itemRows] = await Promise.all([listRegions(), listItems()]);
      setRegions(regionRows);
      setItems(itemRows);
      setToRegionId((current) => {
        if (current && regionRows.some((region) => region.id === current)) {
          return current;
        }

        const firstNonHome = regionRows.find((region) => region.id !== activeCompany?.regionId);
        return firstNonHome?.id ?? regionRows[0]?.id ?? "";
      });
      setItemId((current) => {
        if (current && itemRows.some((item) => item.id === current)) {
          return current;
        }
        return itemRows[0]?.id ?? "";
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load logistics catalog");
    }
  }, [activeCompany?.regionId]);

  const loadShipments = useCallback(async () => {
    if (!activeCompanyId) {
      setShipments([]);
      return;
    }

    setIsLoading(true);
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
      setIsLoading(false);
    }
  }, [activeCompanyId]);

  const loadArbitrage = useCallback(async () => {
    if (!itemId || regions.length === 0) {
      setAnalyticsByRegion({});
      return;
    }

    setIsLoadingArbitrage(true);
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
      setIsLoadingArbitrage(false);
    }
  }, [itemId, regions]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    void loadShipments();
  }, [loadShipments]);

  useEffect(() => {
    void loadArbitrage();
  }, [loadArbitrage]);

  useEffect(() => {
    const tick = health?.currentTick;
    if (tick === undefined || !activeCompanyId) {
      return;
    }

    const timeout = setTimeout(() => {
      void loadShipments();
    }, SHIPMENT_REFRESH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [health?.currentTick, activeCompanyId, loadShipments]);

  useEffect(() => {
    const tick = health?.currentTick;
    if (tick === undefined) {
      return;
    }
    const timeout = setTimeout(() => {
      void loadArbitrage();
    }, SHIPMENT_REFRESH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [health?.currentTick, loadArbitrage]);

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

    const confirmed = window.confirm(
      `Ship ${quantity} units to ${selectedToRegionLabel} for ${formatCents(
        String(feeCents)
      )}. ETA ${UI_CADENCE_TERMS.singular.toLowerCase()} ${arrivalTick}.`
    );
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
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger>
                <SelectValue placeholder="Item" />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    <ItemLabel itemCode={item.code} itemName={item.name} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              {!isLoadingArbitrage && arbitrageRows.length === 0 ? (
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
        <CardContent className="pt-0">
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
              {inTransit.map((shipment) => (
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
              {!isLoading && inTransit.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No shipments in transit.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delivered / Cancelled</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
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
              {delivered.map((shipment) => (
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
              {!isLoading && delivered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No shipment history yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

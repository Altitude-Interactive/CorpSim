"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useActiveCompany } from "@/components/company/active-company-provider";
import { ItemLabel } from "@/components/items/item-label";
import { useWorldHealth } from "@/components/layout/world-health-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableSkeletonRows } from "@/components/ui/table-skeleton-rows";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ApiClientError,
  ItemCatalogItem,
  MarketAnalyticsSummary,
  MarketCandle,
  RegionSummary,
  getMarketAnalyticsSummary,
  listItems,
  listMarketCandles,
  listProductionRecipes,
  listRegions
} from "@/lib/api";
import { formatCents } from "@/lib/format";
import { UI_CADENCE_TERMS } from "@/lib/ui-terms";
import { getRegionLabel } from "@/lib/ui-copy";
import { AnalyticsKpiCards } from "./analytics-kpi-cards";
import { CandleVolumeChart } from "./candle-volume-chart";

const ANALYTICS_REFRESH_DEBOUNCE_MS = 500;
const DEFAULT_POINTS = 200;
const ANALYTICS_ITEM_SELECT_LIMIT = 200;

function mapApiError(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === 404) {
      return "Item not found.";
    }
    return error.message;
  }

  return error instanceof Error ? error.message : "Unexpected analytics error";
}

function formatOptionalCents(value: string | null): string {
  if (value === null) {
    return "--";
  }
  return formatCents(value);
}

export function AnalyticsPage() {
  const { health } = useWorldHealth();
  const { activeCompany } = useActiveCompany();

  const [items, setItems] = useState<ItemCatalogItem[]>([]);
  const [regions, setRegions] = useState<RegionSummary[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [itemSearch, setItemSearch] = useState("");
  const [selectedRegionId, setSelectedRegionId] = useState<string>("");
  const [pointLimit, setPointLimit] = useState<number>(DEFAULT_POINTS);
  const [candles, setCandles] = useState<MarketCandle[]>([]);
  const [summary, setSummary] = useState<MarketAnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedAnalytics, setHasLoadedAnalytics] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deferredItemSearch = useDeferredValue(itemSearch);
  const hasLoadedAnalyticsRef = useRef(false);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId]
  );

  const sortedItems = useMemo(
    () => [...items].sort((left, right) => left.name.localeCompare(right.name)),
    [items]
  );
  const filteredItemOptions = useMemo(() => {
    const needle = deferredItemSearch.trim().toLowerCase();
    if (!needle) {
      return sortedItems;
    }
    return sortedItems.filter((item) =>
      `${item.code} ${item.name}`.toLowerCase().includes(needle)
    );
  }, [deferredItemSearch, sortedItems]);
  const visibleItemOptions = useMemo(() => {
    const selected = sortedItems.find((item) => item.id === selectedItemId) ?? null;
    const head = filteredItemOptions.slice(0, ANALYTICS_ITEM_SELECT_LIMIT);
    if (!selected || head.some((item) => item.id === selected.id)) {
      return head;
    }
    return [selected, ...head.slice(0, ANALYTICS_ITEM_SELECT_LIMIT - 1)];
  }, [filteredItemOptions, selectedItemId, sortedItems]);

  const loadCatalog = useCallback(async () => {
    const [itemRows, regionRows] = await Promise.all([listItems(), listRegions()]);
    const unlockedRecipes = activeCompany?.id
      ? await listProductionRecipes(activeCompany.id)
      : [];
    const unlockedItemIds = new Set<string>();
    for (const recipe of unlockedRecipes) {
      unlockedItemIds.add(recipe.outputItem.id);
      for (const input of recipe.inputs) {
        unlockedItemIds.add(input.itemId);
      }
    }

    const filteredItems =
      unlockedItemIds.size === 0
        ? itemRows
        : itemRows.filter((item) => unlockedItemIds.has(item.id));

    setItems(filteredItems);
    setRegions(regionRows);
    setSelectedItemId((current) => {
      if (current && filteredItems.some((item) => item.id === current)) {
        return current;
      }
      return filteredItems[0]?.id ?? "";
    });
    setSelectedRegionId((current) => {
      if (current && regionRows.some((region) => region.id === current)) {
        return current;
      }
      if (activeCompany?.regionId && regionRows.some((region) => region.id === activeCompany.regionId)) {
        return activeCompany.regionId;
      }
      return regionRows[0]?.id ?? "";
    });
  }, [activeCompany?.id, activeCompany?.regionId]);

  const loadAnalytics = useCallback(async (options?: { showLoadingState?: boolean }) => {
    const showLoadingState = options?.showLoadingState ?? !hasLoadedAnalyticsRef.current;
    if (!selectedItemId || !selectedRegionId) {
      setCandles([]);
      setSummary(null);
      if (showLoadingState) {
        setIsLoading(false);
      }
      if (!hasLoadedAnalyticsRef.current) {
        hasLoadedAnalyticsRef.current = true;
        setHasLoadedAnalytics(true);
      }
      return;
    }

    if (showLoadingState) {
      setIsLoading(true);
    }
    try {
      const [candleRows, summaryRow] = await Promise.all([
        listMarketCandles({
          itemId: selectedItemId,
          regionId: selectedRegionId,
          limit: pointLimit
        }),
        getMarketAnalyticsSummary(selectedItemId, selectedRegionId, pointLimit)
      ]);

      setCandles(candleRows);
      setSummary(summaryRow);
      setError(null);
    } catch (caught) {
      setError(mapApiError(caught));
    } finally {
      if (showLoadingState) {
        setIsLoading(false);
      }
      if (!hasLoadedAnalyticsRef.current) {
        hasLoadedAnalyticsRef.current = true;
        setHasLoadedAnalytics(true);
      }
    }
  }, [pointLimit, selectedItemId, selectedRegionId]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (activeCompany?.regionId) {
      setSelectedRegionId(activeCompany.regionId);
    }
  }, [activeCompany?.regionId]);

  useEffect(() => {
    void loadAnalytics({ showLoadingState: !hasLoadedAnalyticsRef.current });
  }, [loadAnalytics]);

  useEffect(() => {
    if (!selectedItemId || !selectedRegionId || health?.currentTick === undefined) {
      return;
    }

    const timeout = setTimeout(() => {
      void loadAnalytics({ showLoadingState: false });
    }, ANALYTICS_REFRESH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [health?.currentTick, loadAnalytics, selectedItemId, selectedRegionId]);
  const showInitialSkeleton = isLoading && !hasLoadedAnalytics;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Market Analytics</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-[minmax(0,320px)_320px_180px_240px_minmax(0,1fr)]">
          <Input
            value={itemSearch}
            onChange={(event) => setItemSearch(event.target.value)}
            placeholder="Search item by code or name"
          />
          <div className="space-y-1">
            <Select value={selectedItemId} onValueChange={setSelectedItemId}>
              <SelectTrigger>
                <SelectValue placeholder="Select item" />
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
          <Select
            value={String(pointLimit)}
            onValueChange={(value) => setPointLimit(Number.parseInt(value, 10))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Data points" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="50">50 data points</SelectItem>
              <SelectItem value="100">100 data points</SelectItem>
              <SelectItem value="200">200 data points</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedRegionId} onValueChange={setSelectedRegionId}>
            <SelectTrigger>
              <SelectValue placeholder="Region" />
            </SelectTrigger>
            <SelectContent>
              {regions.map((region) => (
                <SelectItem key={region.id} value={region.id}>
                  {getRegionLabel({ code: region.code, name: region.name })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="self-center text-sm text-muted-foreground">
            {selectedItem ? (
              <ItemLabel itemCode={selectedItem.code} itemName={selectedItem.name} />
            ) : (
              "No item selected"
            )}
          </p>
          {error ? <p className="text-sm text-red-300 lg:col-span-5">{error}</p> : null}
        </CardContent>
      </Card>

      <AnalyticsKpiCards summary={summary} isLoading={showInitialSkeleton} />
      <CandleVolumeChart candles={candles} />

      <Card>
        <CardHeader>
          <CardTitle>Recent Price Bars</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{UI_CADENCE_TERMS.singularTitle}</TableHead>
                <TableHead>Open</TableHead>
                <TableHead>High</TableHead>
                <TableHead>Low</TableHead>
                <TableHead>Close</TableHead>
                <TableHead>Volume</TableHead>
                <TableHead>Trades</TableHead>
                <TableHead>VWAP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {showInitialSkeleton && candles.length === 0 ? <TableSkeletonRows columns={8} /> : null}
              {candles
                .slice()
                .reverse()
                .slice(0, 20)
                .map((candle) => (
                  <TableRow key={candle.id}>
                    <TableCell className="tabular-nums">{candle.tick.toLocaleString()}</TableCell>
                    <TableCell className="tabular-nums">{formatCents(candle.openCents)}</TableCell>
                    <TableCell className="tabular-nums">{formatCents(candle.highCents)}</TableCell>
                    <TableCell className="tabular-nums">{formatCents(candle.lowCents)}</TableCell>
                    <TableCell className="tabular-nums">{formatCents(candle.closeCents)}</TableCell>
                    <TableCell className="tabular-nums">{candle.volumeQty.toLocaleString()}</TableCell>
                    <TableCell className="tabular-nums">{candle.tradeCount.toLocaleString()}</TableCell>
                    <TableCell className="tabular-nums">
                      {formatOptionalCents(candle.vwapCents)}
                    </TableCell>
                  </TableRow>
                ))}
              {!showInitialSkeleton && candles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No candle history yet for this item.
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

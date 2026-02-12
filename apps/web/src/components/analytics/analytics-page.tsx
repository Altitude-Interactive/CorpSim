"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useActiveCompany } from "@/components/company/active-company-provider";
import { useWorldHealth } from "@/components/layout/world-health-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  listRegions
} from "@/lib/api";
import { formatCents } from "@/lib/format";
import { UI_CADENCE_TERMS } from "@/lib/ui-terms";
import { AnalyticsKpiCards } from "./analytics-kpi-cards";
import { CandleVolumeChart } from "./candle-volume-chart";

const ANALYTICS_REFRESH_DEBOUNCE_MS = 500;
const DEFAULT_POINTS = 200;

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
  const [selectedRegionId, setSelectedRegionId] = useState<string>("");
  const [pointLimit, setPointLimit] = useState<number>(DEFAULT_POINTS);
  const [candles, setCandles] = useState<MarketCandle[]>([]);
  const [summary, setSummary] = useState<MarketAnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId]
  );

  const loadCatalog = useCallback(async () => {
    const [itemRows, regionRows] = await Promise.all([listItems(), listRegions()]);
    setItems(itemRows);
    setRegions(regionRows);
    setSelectedItemId((current) => {
      if (current && itemRows.some((item) => item.id === current)) {
        return current;
      }
      return itemRows[0]?.id ?? "";
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
  }, [activeCompany?.regionId]);

  const loadAnalytics = useCallback(async () => {
    if (!selectedItemId || !selectedRegionId) {
      setCandles([]);
      setSummary(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
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
      setIsLoading(false);
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
    void loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    if (!selectedItemId || !selectedRegionId || health?.currentTick === undefined) {
      return;
    }

    const timeout = setTimeout(() => {
      void loadAnalytics();
    }, ANALYTICS_REFRESH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [health?.currentTick, loadAnalytics, selectedItemId, selectedRegionId]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Market Analytics</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-[320px_180px_240px_minmax(0,1fr)]">
          <Select value={selectedItemId} onValueChange={setSelectedItemId}>
            <SelectTrigger>
              <SelectValue placeholder="Select item" />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.code} - {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(pointLimit)}
            onValueChange={(value) => setPointLimit(Number.parseInt(value, 10))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Points" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="50">50 points</SelectItem>
              <SelectItem value="100">100 points</SelectItem>
              <SelectItem value="200">200 points</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedRegionId} onValueChange={setSelectedRegionId}>
            <SelectTrigger>
              <SelectValue placeholder="Region" />
            </SelectTrigger>
            <SelectContent>
              {regions.map((region) => (
                <SelectItem key={region.id} value={region.id}>
                  {region.code} - {region.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="self-center text-sm text-muted-foreground">
            {selectedItem ? `${selectedItem.code} - ${selectedItem.name}` : "No item selected"}
          </p>
          {error ? <p className="text-sm text-red-300 lg:col-span-4">{error}</p> : null}
        </CardContent>
      </Card>

      <AnalyticsKpiCards summary={summary} isLoading={isLoading} />
      <CandleVolumeChart candles={candles} />

      <Card>
        <CardHeader>
          <CardTitle>Recent Candles</CardTitle>
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
              {!isLoading && candles.length === 0 ? (
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

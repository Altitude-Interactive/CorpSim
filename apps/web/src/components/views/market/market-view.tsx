"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MarketOrder, listMarketOrders } from "@/lib/api";

const DEFAULT_LIMIT = 100;

interface MarketFiltersForm {
  itemId: string;
  companyId: string;
  side: "ALL" | "BUY" | "SELL";
  limit: string;
}

const INITIAL_FILTERS: MarketFiltersForm = {
  itemId: "",
  companyId: "",
  side: "ALL",
  limit: String(DEFAULT_LIMIT)
};

export function MarketView() {
  const [filters, setFilters] = useState<MarketFiltersForm>(INITIAL_FILTERS);
  const [orders, setOrders] = useState<MarketOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async (activeFilters: MarketFiltersForm) => {
    setIsLoading(true);
    try {
      const parsedLimit = Number.parseInt(activeFilters.limit, 10);
      const next = await listMarketOrders({
        itemId: activeFilters.itemId || undefined,
        companyId: activeFilters.companyId || undefined,
        side: activeFilters.side === "ALL" ? undefined : activeFilters.side,
        limit: Number.isInteger(parsedLimit) ? parsedLimit : DEFAULT_LIMIT
      });
      setOrders(next);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load market orders");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders(INITIAL_FILTERS);
  }, [loadOrders]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadOrders(filters);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Market Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-5" onSubmit={onSubmit}>
            <Input
              placeholder="Item ID"
              value={filters.itemId}
              onChange={(event) => setFilters((prev) => ({ ...prev, itemId: event.target.value }))}
            />
            <Select
              value={filters.side}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, side: value as MarketFiltersForm["side"] }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Side" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All sides</SelectItem>
                <SelectItem value="BUY">BUY</SelectItem>
                <SelectItem value="SELL">SELL</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Company ID"
              value={filters.companyId}
              onChange={(event) => setFilters((prev) => ({ ...prev, companyId: event.target.value }))}
            />
            <Input
              placeholder="Limit"
              value={filters.limit}
              onChange={(event) => setFilters((prev) => ({ ...prev, limit: event.target.value }))}
            />
            <Button type="submit">Apply Filters</Button>
          </form>
          {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Side</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Remaining</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-xs">{order.id}</TableCell>
                  <TableCell className="font-mono text-xs">{order.itemId}</TableCell>
                  <TableCell className="font-mono text-xs">{order.companyId}</TableCell>
                  <TableCell>{order.side}</TableCell>
                  <TableCell>{order.status}</TableCell>
                  <TableCell className="tabular-nums">{order.priceCents}</TableCell>
                  <TableCell className="tabular-nums">{order.quantity}</TableCell>
                  <TableCell className="tabular-nums">{order.remainingQuantity}</TableCell>
                </TableRow>
              ))}
              {!isLoading && orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No orders found for selected filters.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          {isLoading ? <p className="mt-3 text-sm text-muted-foreground">Loading market orders...</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

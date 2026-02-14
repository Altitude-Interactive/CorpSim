import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ItemLabel } from "@/components/items/item-label";
import { DeferredSearchStatus } from "@/components/ui/deferred-search-status";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableFillerRows } from "@/components/ui/table-filler-rows";
import { TableSkeletonRows } from "@/components/ui/table-skeleton-rows";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MarketOrder } from "@/lib/api";
import { formatCents } from "@/lib/format";
import { UI_COPY } from "@/lib/ui-copy";
import { UI_CADENCE_TERMS } from "@/lib/ui-terms";
import { SideBadge, StatusBadge } from "./market-badges";

interface MyOrdersCardProps {
  orders: MarketOrder[];
  isLoading: boolean;
  onCancel: (order: MarketOrder) => Promise<void>;
  regionNameById: Record<string, string>;
  itemMetaById: Record<string, { code: string; name: string }>;
}

const MY_ORDERS_PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

export function MyOrdersCard({
  orders,
  isLoading,
  onCancel,
  regionNameById,
  itemMetaById
}: MyOrdersCardProps) {
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState<(typeof MY_ORDERS_PAGE_SIZE_OPTIONS)[number]>(20);
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);

  const indexedOrders = useMemo(
    () =>
      orders.map((order) => {
        const item = itemMetaById[order.itemId];
        const itemName = item?.name ?? "";
        const itemCode = item?.code ?? "";
        const regionName = regionNameById[order.regionId] ?? "";
        return {
          order,
          searchText: `${itemCode} ${itemName} ${regionName} ${order.side} ${order.status}`.toLowerCase()
        };
      }),
    [itemMetaById, orders, regionNameById]
  );

  const filteredOrders = useMemo(() => {
    const needle = deferredSearch.trim().toLowerCase();
    if (!needle) {
      return indexedOrders.map((entry) => entry.order);
    }

    return indexedOrders
      .filter((entry) => entry.searchText.includes(needle))
      .map((entry) => entry.order);
  }, [deferredSearch, indexedOrders]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredOrders.length / pageSize)),
    [filteredOrders.length, pageSize]
  );

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pagedOrders = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, page, pageSize]);

  const rangeLabel = useMemo(() => {
    if (filteredOrders.length === 0) {
      return "0-0";
    }
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, filteredOrders.length);
    return `${start}-${end}`;
  }, [filteredOrders.length, page, pageSize]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Orders</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search item, region, side, status"
            className="w-full md:w-72"
          />
          <Select
            value={String(pageSize)}
            onValueChange={(value) =>
              setPageSize(Number.parseInt(value, 10) as (typeof MY_ORDERS_PAGE_SIZE_OPTIONS)[number])
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Page size" />
            </SelectTrigger>
            <SelectContent>
              {MY_ORDERS_PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>
            Showing {rangeLabel} of {filteredOrders.length} rows ({orders.length} total)
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
              <TableHead>{`Placed ${UI_CADENCE_TERMS.singularTitle}`}</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Side</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Remaining</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && pagedOrders.length === 0 ? (
              <TableSkeletonRows columns={8} />
            ) : null}
            {pagedOrders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="tabular-nums">{order.tickPlaced.toLocaleString()}</TableCell>
                <TableCell className="text-xs">
                  <ItemLabel
                    itemCode={itemMetaById[order.itemId]?.code}
                    itemName={itemMetaById[order.itemId]?.name ?? UI_COPY.common.unknownItem}
                  />
                </TableCell>
                <TableCell className="text-xs">
                  {regionNameById[order.regionId] ?? UI_COPY.common.unknownRegion}
                </TableCell>
                <TableCell>
                  <SideBadge side={order.side} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={order.status} />
                </TableCell>
                <TableCell className="tabular-nums">{formatCents(order.priceCents)}</TableCell>
                <TableCell className="tabular-nums">{order.remainingQuantity}</TableCell>
                <TableCell className="text-right">
                  {order.status === "OPEN" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        void onCancel(order);
                      }}
                    >
                      Cancel
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Closed</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && pagedOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No orders for the active company.
                </TableCell>
              </TableRow>
            ) : null}
            {!isLoading ? (
              <TableFillerRows
                columns={8}
                currentRows={Math.max(1, pagedOrders.length)}
                targetRows={pageSize}
              />
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

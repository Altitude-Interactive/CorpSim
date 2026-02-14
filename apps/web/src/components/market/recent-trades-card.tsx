import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ItemLabel } from "@/components/items/item-label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableSkeletonRows } from "@/components/ui/table-skeleton-rows";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MarketTrade } from "@/lib/api";
import { formatCents } from "@/lib/format";
import { UI_CADENCE_TERMS } from "@/lib/ui-terms";
import { UI_COPY } from "@/lib/ui-copy";

interface RecentTradesCardProps {
  trades: MarketTrade[];
  isLoading: boolean;
  regionNameById: Record<string, string>;
  itemMetaById: Record<string, { code: string; name: string }>;
  companyNameById: Record<string, string>;
}

const RECENT_TRADES_PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

export function RecentTradesCard({
  trades,
  isLoading,
  regionNameById,
  itemMetaById,
  companyNameById
}: RecentTradesCardProps) {
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState<(typeof RECENT_TRADES_PAGE_SIZE_OPTIONS)[number]>(50);
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);

  const filteredTrades = useMemo(() => {
    const needle = deferredSearch.trim().toLowerCase();
    if (!needle) {
      return trades;
    }

    return trades.filter((trade) => {
      const item = itemMetaById[trade.itemId];
      const itemName = item?.name ?? "";
      const itemCode = item?.code ?? "";
      const buyer = companyNameById[trade.buyerId] ?? "";
      const seller = companyNameById[trade.sellerId] ?? "";
      const region = regionNameById[trade.regionId] ?? "";
      const haystack = `${itemCode} ${itemName} ${buyer} ${seller} ${region}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [companyNameById, deferredSearch, itemMetaById, regionNameById, trades]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredTrades.length / pageSize)),
    [filteredTrades.length, pageSize]
  );

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pagedTrades = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTrades.slice(start, start + pageSize);
  }, [filteredTrades, page, pageSize]);

  const rangeLabel = useMemo(() => {
    if (filteredTrades.length === 0) {
      return "0-0";
    }
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, filteredTrades.length);
    return `${start}-${end}`;
  }, [filteredTrades.length, page, pageSize]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Trades</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search item, buyer, seller, region"
            className="w-full md:w-72"
          />
          <Select
            value={String(pageSize)}
            onValueChange={(value) =>
              setPageSize(Number.parseInt(value, 10) as (typeof RECENT_TRADES_PAGE_SIZE_OPTIONS)[number])
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Page size" />
            </SelectTrigger>
            <SelectContent>
              {RECENT_TRADES_PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>
            Showing {rangeLabel} of {filteredTrades.length} rows ({trades.length} total)
          </p>
          {deferredSearch !== search ? <p>Updating results...</p> : null}
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
              <TableHead>{UI_CADENCE_TERMS.singularTitle}</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Buyer</TableHead>
              <TableHead>Seller</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && pagedTrades.length === 0 ? (
              <TableSkeletonRows columns={8} />
            ) : null}
            {pagedTrades.map((trade) => (
              <TableRow key={trade.id}>
                <TableCell className="tabular-nums">{trade.tick}</TableCell>
                <TableCell className="text-xs">
                  <ItemLabel
                    itemCode={itemMetaById[trade.itemId]?.code}
                    itemName={itemMetaById[trade.itemId]?.name ?? UI_COPY.common.unknownItem}
                  />
                </TableCell>
                <TableCell className="text-xs">
                  {regionNameById[trade.regionId] ?? UI_COPY.common.unknownRegion}
                </TableCell>
                <TableCell className="text-xs">
                  {companyNameById[trade.buyerId] ?? UI_COPY.common.unknownCompany}
                </TableCell>
                <TableCell className="text-xs">
                  {companyNameById[trade.sellerId] ?? UI_COPY.common.unknownCompany}
                </TableCell>
                <TableCell className="tabular-nums">{formatCents(trade.priceCents)}</TableCell>
                <TableCell className="tabular-nums">{trade.quantity}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(trade.createdAt).toLocaleTimeString()}
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && pagedTrades.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No recent trades found.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

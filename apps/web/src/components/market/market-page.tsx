"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useActiveCompany } from "@/components/company/active-company-provider";
import { ItemLabel } from "@/components/items/item-label";
import { useWorldHealth } from "@/components/layout/world-health-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  ApiClientError,
  CompanySummary,
  InventoryRow,
  ItemCatalogItem,
  MarketOrder,
  MarketTrade,
  RegionSummary,
  cancelMarketOrder,
  listCompanyInventory,
  listCompanies,
  listItems,
  listMarketOrders,
  listRegions,
  listMarketTrades,
  listProductionRecipes,
  placeMarketOrder
} from "@/lib/api";
import { formatCents } from "@/lib/format";
import { formatCodeLabel, getRegionLabel, UI_COPY } from "@/lib/ui-copy";
import { MyOrdersCard } from "./my-orders-card";
import { OrderBookCard } from "./order-book-card";
import { OrderPlacementCard } from "./order-placement-card";
import { RecentTradesCard } from "./recent-trades-card";

const DEFAULT_ORDER_LIMIT = 100;
const DEFAULT_TRADE_LIMIT = 50;
const MARKET_REFRESH_DEBOUNCE_MS = 500;

interface OrderBookFilters {
  itemId: string;
  side: "ALL" | "BUY" | "SELL";
  status: "ALL" | "OPEN" | "FILLED" | "CANCELLED";
  companyId: string;
  limit: string;
}

interface TradeFilters {
  itemId: string;
  myTradesOnly: boolean;
}

const INITIAL_ORDER_FILTERS: OrderBookFilters = {
  itemId: "",
  side: "ALL",
  status: "OPEN",
  companyId: "",
  limit: String(DEFAULT_ORDER_LIMIT)
};

const INITIAL_TRADE_FILTERS: TradeFilters = {
  itemId: "",
  myTradesOnly: false
};

function mapApiErrorToMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === 400) {
      return error.message;
    }
    if (error.status === 404) {
      return UI_COPY.common.recordNotFound;
    }
    if (error.status === 409) {
      return UI_COPY.common.dataChangedRetry;
    }
    return error.message;
  }

  return error instanceof Error ? error.message : "Unexpected error";
}

export function MarketPage() {
  const { showToast } = useToast();
  const { activeCompanyId, activeCompany } = useActiveCompany();
  const { health, refresh: refreshHealth } = useWorldHealth();

  const [items, setItems] = useState<ItemCatalogItem[]>([]);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [regions, setRegions] = useState<RegionSummary[]>([]);
  const [unlockedItemIds, setUnlockedItemIds] = useState<string[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<string>("");
  const [orderFilters, setOrderFilters] = useState<OrderBookFilters>(INITIAL_ORDER_FILTERS);
  const [tradeFilters, setTradeFilters] = useState<TradeFilters>(INITIAL_TRADE_FILTERS);
  const orderFiltersRef = useRef(orderFilters);
  const tradeFiltersRef = useRef(tradeFilters);

  const [orderBook, setOrderBook] = useState<MarketOrder[]>([]);
  const [myOrders, setMyOrders] = useState<MarketOrder[]>([]);
  const [trades, setTrades] = useState<MarketTrade[]>([]);

  const [isLoadingOrderBook, setIsLoadingOrderBook] = useState(true);
  const [isLoadingMyOrders, setIsLoadingMyOrders] = useState(true);
  const [isLoadingTrades, setIsLoadingTrades] = useState(true);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [isCancellingOrderId, setIsCancellingOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCatalog = useCallback(async (): Promise<string> => {
    const [itemRows, regionRows, companyRows] = await Promise.all([
      listItems(),
      listRegions(),
      listCompanies()
    ]);

    const [unlockedRecipeRows, inventoryRows] = activeCompanyId
      ? await Promise.all([
          listProductionRecipes(activeCompanyId),
          listCompanyInventory(activeCompanyId)
        ])
      : [[], [] as InventoryRow[]];

    const unlockedIds = new Set<string>();
    for (const recipe of unlockedRecipeRows) {
      unlockedIds.add(recipe.outputItem.id);
      for (const input of recipe.inputs) {
        unlockedIds.add(input.itemId);
      }
    }
    for (const row of inventoryRows) {
      unlockedIds.add(row.itemId);
    }

    setUnlockedItemIds(Array.from(unlockedIds));
    setItems(itemRows);
    setRegions(regionRows);
    setCompanies(companyRows);
    let resolvedRegionId = "";
    setSelectedRegionId((current) => {
      if (current && regionRows.some((region) => region.id === current)) {
        resolvedRegionId = current;
        return current;
      }
      if (activeCompany?.regionId && regionRows.some((region) => region.id === activeCompany.regionId)) {
        resolvedRegionId = activeCompany.regionId;
        return activeCompany.regionId;
      }
      resolvedRegionId = regionRows[0]?.id ?? "";
      return resolvedRegionId;
    });
    return resolvedRegionId;
  }, [activeCompany?.regionId, activeCompanyId]);

  useEffect(() => {
    if (!activeCompany?.regionId) {
      return;
    }
    setSelectedRegionId(activeCompany.regionId);
  }, [activeCompany?.regionId]);

  useEffect(() => {
    orderFiltersRef.current = orderFilters;
  }, [orderFilters]);

  useEffect(() => {
    tradeFiltersRef.current = tradeFilters;
  }, [tradeFilters]);

  const loadOrderBook = useCallback(async (
    filters: OrderBookFilters,
    regionId: string,
    options?: { showLoadingState?: boolean }
  ) => {
    const showLoadingState = options?.showLoadingState ?? true;
    if (showLoadingState) {
      setIsLoadingOrderBook(true);
    }
    try {
      const parsedLimit = Number.parseInt(filters.limit, 10);
      const rows = await listMarketOrders({
        regionId: regionId || undefined,
        itemId: filters.itemId || undefined,
        side: filters.side === "ALL" ? undefined : filters.side,
        status: filters.status === "ALL" ? undefined : filters.status,
        companyId: filters.companyId || undefined,
        limit: Number.isInteger(parsedLimit) ? parsedLimit : DEFAULT_ORDER_LIMIT
      });
      setOrderBook(rows);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load market orders");
    } finally {
      if (showLoadingState) {
        setIsLoadingOrderBook(false);
      }
    }
  }, []);

  const loadMyOrders = useCallback(async (
    regionId: string,
    options?: { showLoadingState?: boolean }
  ) => {
    if (!activeCompanyId) {
      setMyOrders([]);
      setIsLoadingMyOrders(false);
      return;
    }

    const showLoadingState = options?.showLoadingState ?? true;
    if (showLoadingState) {
      setIsLoadingMyOrders(true);
    }
    try {
      const rows = await listMarketOrders({
        companyId: activeCompanyId,
        regionId: regionId || undefined,
        limit: 200
      });
      setMyOrders(rows);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load company orders");
    } finally {
      if (showLoadingState) {
        setIsLoadingMyOrders(false);
      }
    }
  }, [activeCompanyId]);

  const loadTrades = useCallback(async (
    filters: TradeFilters,
    regionId: string,
    options?: { showLoadingState?: boolean }
  ) => {
    const showLoadingState = options?.showLoadingState ?? true;
    if (showLoadingState) {
      setIsLoadingTrades(true);
    }
    try {
      const rows = await listMarketTrades({
        regionId: regionId || undefined,
        itemId: filters.itemId || undefined,
        companyId: filters.myTradesOnly ? activeCompanyId ?? undefined : undefined,
        limit: DEFAULT_TRADE_LIMIT
      });
      setTrades(rows);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load trades");
    } finally {
      if (showLoadingState) {
        setIsLoadingTrades(false);
      }
    }
  }, [activeCompanyId]);

  const refreshMarketData = useCallback(async (options?: { showLoadingState?: boolean }) => {
    const showLoadingState = options?.showLoadingState ?? true;
    await Promise.all([
      loadOrderBook(orderFilters, selectedRegionId, { showLoadingState }),
      loadMyOrders(selectedRegionId, { showLoadingState }),
      loadTrades(tradeFilters, selectedRegionId, { showLoadingState })
    ]);
  }, [loadMyOrders, loadOrderBook, loadTrades, orderFilters, tradeFilters, selectedRegionId]);

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      try {
        const resolvedRegionId = await loadCatalog();
        if (!isMounted) {
          return;
        }

        await Promise.all([
          loadOrderBook(orderFiltersRef.current, resolvedRegionId, { showLoadingState: true }),
          loadMyOrders(resolvedRegionId, { showLoadingState: true }),
          loadTrades(tradeFiltersRef.current, resolvedRegionId, { showLoadingState: true })
        ]);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Failed to initialize market page");
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [loadCatalog, loadMyOrders, loadOrderBook, loadTrades]);

  useEffect(() => {
    const tick = health?.currentTick;
    if (tick === undefined) {
      return;
    }

    const timeout = setTimeout(() => {
      void Promise.all([
        loadOrderBook(orderFilters, selectedRegionId, { showLoadingState: false }),
        loadTrades(tradeFilters, selectedRegionId, { showLoadingState: false })
      ]);
    }, MARKET_REFRESH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [health?.currentTick, loadOrderBook, loadTrades, orderFilters, selectedRegionId, tradeFilters]);

  const submitOrderBookFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void Promise.all([
      loadOrderBook(orderFilters, selectedRegionId, { showLoadingState: true }),
      loadMyOrders(selectedRegionId, { showLoadingState: false })
    ]);
  };

  const submitTradesFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadTrades(tradeFilters, selectedRegionId, { showLoadingState: true });
  };

  const handlePlaceOrder = async (input: {
    companyId: string;
    itemId: string;
    regionId?: string;
    side: "BUY" | "SELL";
    priceCents: number;
    quantity: number;
  }) => {
    setIsSubmittingOrder(true);
    try {
      await placeMarketOrder(input);
      showToast({
        title: "Order placed",
        description: `${formatCodeLabel(input.side)} ${input.quantity} @ ${formatCents(String(input.priceCents))}`,
        variant: "success"
      });
      await Promise.all([refreshMarketData({ showLoadingState: false }), refreshHealth()]);
    } catch (caught) {
      const message = mapApiErrorToMessage(caught);
      showToast({
        title: "Order placement failed",
        description: message,
        variant: "error"
      });
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const handleCancelOrder = async (order: MarketOrder) => {
    setIsCancellingOrderId(order.id);
    try {
      const result = await cancelMarketOrder(order.id);

      if (result.status !== "CANCELLED") {
        showToast({
          title: "Order already closed",
          description: `Status is ${formatCodeLabel(result.status)}.`,
          variant: "info"
        });
      } else {
        showToast({
          title: "Order cancelled",
          description: "The order was cancelled successfully.",
          variant: "success"
        });
      }

      await Promise.all([refreshMarketData({ showLoadingState: false }), refreshHealth()]);
    } catch (caught) {
      showToast({
        title: "Cancel failed",
        description: mapApiErrorToMessage(caught),
        variant: "error"
      });
    } finally {
      setIsCancellingOrderId(null);
    }
  };

  const sortedItems = useMemo(
    () => [...items].sort((left, right) => left.name.localeCompare(right.name)),
    [items]
  );
  const unlockedItemIdSet = useMemo(() => new Set(unlockedItemIds), [unlockedItemIds]);
  const sortedSelectableItems = useMemo(() => {
    if (unlockedItemIdSet.size === 0) {
      return sortedItems;
    }
    return sortedItems.filter((item) => unlockedItemIdSet.has(item.id));
  }, [sortedItems, unlockedItemIdSet]);
  const sortedCompanies = useMemo(
    () => [...companies].sort((left, right) => left.name.localeCompare(right.name)),
    [companies]
  );
  const regionNameById = useMemo(
    () =>
      Object.fromEntries(
        regions.map((region) => [
          region.id,
          getRegionLabel({
            code: region.code,
            name: region.name
          })
        ])
      ),
    [regions]
  );
  const itemMetaById = useMemo(
    () => Object.fromEntries(items.map((item) => [item.id, { code: item.code, name: item.name }])),
    [items]
  );
  const companyNameById = useMemo(
    () => Object.fromEntries(companies.map((company) => [company.id, company.name])),
    [companies]
  );
  const activeCompanyRegionLabel = activeCompany
    ? getRegionLabel({
      code: activeCompany.regionCode,
      name: activeCompany.regionName
    })
    : null;

  useEffect(() => {
    if (orderFilters.itemId && !sortedSelectableItems.some((item) => item.id === orderFilters.itemId)) {
      setOrderFilters((prev) => ({ ...prev, itemId: "" }));
    }
  }, [orderFilters.itemId, sortedSelectableItems]);

  useEffect(() => {
    if (tradeFilters.itemId && !sortedSelectableItems.some((item) => item.id === tradeFilters.itemId)) {
      setTradeFilters((prev) => ({ ...prev, itemId: "" }));
    }
  }, [tradeFilters.itemId, sortedSelectableItems]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <OrderPlacementCard
          activeCompany={activeCompany}
          items={sortedSelectableItems}
          onSubmit={handlePlaceOrder}
          isSubmitting={isSubmittingOrder}
        />

        <Card>
          <CardHeader>
            <CardTitle>Order Book Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)_7rem_auto]"
              onSubmit={submitOrderBookFilters}
            >
              <Select
                value={selectedRegionId || "ALL"}
                onValueChange={(value) => setSelectedRegionId(value === "ALL" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All regions</SelectItem>
                  {regions.map((region) => (
                    <SelectItem key={region.id} value={region.id}>
                      {getRegionLabel({ code: region.code, name: region.name })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={orderFilters.side}
                onValueChange={(value) =>
                  setOrderFilters((prev) => ({ ...prev, side: value as OrderBookFilters["side"] }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Side" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All sides</SelectItem>
                  <SelectItem value="BUY">{formatCodeLabel("BUY")}</SelectItem>
                  <SelectItem value="SELL">{formatCodeLabel("SELL")}</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={orderFilters.status}
                onValueChange={(value) =>
                  setOrderFilters((prev) => ({ ...prev, status: value as OrderBookFilters["status"] }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  <SelectItem value="OPEN">{formatCodeLabel("OPEN")}</SelectItem>
                  <SelectItem value="FILLED">{formatCodeLabel("FILLED")}</SelectItem>
                  <SelectItem value="CANCELLED">{formatCodeLabel("CANCELLED")}</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={orderFilters.itemId || "ALL"}
                onValueChange={(value) =>
                  setOrderFilters((prev) => ({ ...prev, itemId: value === "ALL" ? "" : value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All items" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All items</SelectItem>
                  {sortedSelectableItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      <ItemLabel itemCode={item.code} itemName={item.name} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={orderFilters.companyId || "ALL"}
                onValueChange={(value) =>
                  setOrderFilters((prev) => ({ ...prev, companyId: value === "ALL" ? "" : value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All companies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All companies</SelectItem>
                  {sortedCompanies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Limit"
                value={orderFilters.limit}
                onChange={(event) =>
                  setOrderFilters((prev) => ({ ...prev, limit: event.target.value }))
                }
                inputMode="numeric"
              />
              <Button type="submit">Apply</Button>
            </form>
            {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
          </CardContent>
        </Card>
      </div>

      <OrderBookCard
        orders={orderBook}
        isLoading={isLoadingOrderBook}
        regionNameById={regionNameById}
        itemMetaById={itemMetaById}
        companyNameById={companyNameById}
      />

      <MyOrdersCard
        orders={myOrders}
        isLoading={isLoadingMyOrders || Boolean(isCancellingOrderId)}
        regionNameById={regionNameById}
        itemMetaById={itemMetaById}
        onCancel={handleCancelOrder}
      />

      <Card>
        <CardHeader>
          <CardTitle>Trades Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 md:grid-cols-[minmax(0,220px)_minmax(0,180px)_auto_auto]"
            onSubmit={submitTradesFilters}
          >
            <Select
              value={tradeFilters.itemId || "ALL"}
              onValueChange={(value) =>
                setTradeFilters((prev) => ({ ...prev, itemId: value === "ALL" ? "" : value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All items" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All items</SelectItem>
                {sortedSelectableItems.map((item) => (
                  <SelectItem value={item.id} key={item.id}>
                    <ItemLabel itemCode={item.code} itemName={item.name} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={selectedRegionId || "ALL"}
              onValueChange={(value) => setSelectedRegionId(value === "ALL" ? "" : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All regions</SelectItem>
                {regions.map((region) => (
                  <SelectItem key={region.id} value={region.id}>
                    {getRegionLabel({ code: region.code, name: region.name })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 rounded-md border border-border px-3 text-sm">
              <input
                type="checkbox"
                checked={tradeFilters.myTradesOnly}
                onChange={(event) =>
                  setTradeFilters((prev) => ({ ...prev, myTradesOnly: event.target.checked }))
                }
              />
              My trades only
            </label>
            <Button type="submit">Apply</Button>
          </form>
          {selectedRegionId && activeCompany && selectedRegionId !== activeCompany.regionId ? (
            <p className="mt-2 text-xs text-amber-300">
              Viewing a non-home region. New orders still place in {activeCompanyRegionLabel}.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <RecentTradesCard
        trades={trades}
        isLoading={isLoadingTrades}
        regionNameById={regionNameById}
        itemMetaById={itemMetaById}
        companyNameById={companyNameById}
      />
    </div>
  );
}

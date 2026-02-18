"use client";

import { FormEvent, useDeferredValue, useMemo, useState } from "react";
import { ItemLabel } from "@/components/items/item-label";
import { useUiSfx } from "@/components/layout/ui-sfx-provider";
import { CompanySummary, ItemCatalogItem, PlaceMarketOrderInput } from "@/lib/api";
import { parseCurrencyToCents } from "@/lib/format";
import { formatCodeLabel, getRegionLabel, UI_COPY } from "@/lib/ui-copy";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface OrderPlacementCardProps {
  activeCompany: CompanySummary | null;
  items: ItemCatalogItem[];
  onSubmit: (input: PlaceMarketOrderInput) => Promise<void>;
  isSubmitting: boolean;
}

const ORDER_PLACEMENT_ITEM_SELECT_LIMIT = 200;

export function OrderPlacementCard({
  activeCompany,
  items,
  onSubmit,
  isSubmitting
}: OrderPlacementCardProps) {
  const { play } = useUiSfx();
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [itemSearch, setItemSearch] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [quantityInput, setQuantityInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const deferredItemSearch = useDeferredValue(itemSearch);

  const selectedItem = useMemo(
    () => items.find((entry) => entry.id === selectedItemId) ?? null,
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
    const head = filteredItemOptions.slice(0, ORDER_PLACEMENT_ITEM_SELECT_LIMIT);
    if (!selected || head.some((item) => item.id === selected.id)) {
      return head;
    }
    return [selected, ...head.slice(0, ORDER_PLACEMENT_ITEM_SELECT_LIMIT - 1)];
  }, [filteredItemOptions, selectedItemId, sortedItems]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    play("ui_open", { volumeMultiplier: 0.65 });

    if (!activeCompany) {
      play("feedback_warning", { volumeMultiplier: 0.7 });
      setError(UI_COPY.common.selectCompanyFirst);
      return;
    }

    const itemId = selectedItem?.id ?? "";
    if (!itemId) {
      play("feedback_warning", { volumeMultiplier: 0.7 });
      setError("Select an item.");
      return;
    }

    const priceCents = parseCurrencyToCents(priceInput);
    if (!priceCents) {
      play("feedback_warning", { volumeMultiplier: 0.7 });
      setError("Price must be greater than zero.");
      return;
    }

    const quantity = Number.parseInt(quantityInput, 10);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      play("feedback_warning", { volumeMultiplier: 0.7 });
      setError("Quantity must be a positive integer.");
      return;
    }

    setError(null);
    await onSubmit({
      companyId: activeCompany.id,
      itemId,
      regionId: activeCompany.regionId,
      side,
      priceCents,
      quantity
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Place Order</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={submit}>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Company</p>
            <p className="text-sm font-medium">
              {activeCompany ? activeCompany.name : UI_COPY.common.noCompanySelected}
            </p>
            {activeCompany ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Trading region:{" "}
                {getRegionLabel({
                  code: activeCompany.regionCode,
                  name: activeCompany.regionName
                })}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Side</p>
              <Select value={side} onValueChange={(value) => setSide(value as "BUY" | "SELL")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BUY">{formatCodeLabel("BUY")}</SelectItem>
                  <SelectItem value="SELL">{formatCodeLabel("SELL")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Quantity</p>
              <Input
                value={quantityInput}
                onChange={(event) => setQuantityInput(event.target.value)}
                placeholder="Enter quantity (e.g., 100)"
              />
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs text-muted-foreground">Item</p>
            <Input
              value={itemSearch}
              onChange={(event) => setItemSearch(event.target.value)}
              placeholder="Search item"
              className="mb-2"
            />
            <Select value={selectedItemId} onValueChange={setSelectedItemId}>
              <SelectTrigger>
                <SelectValue placeholder="Select item" />
              </SelectTrigger>
              <SelectContent>
                {visibleItemOptions.map((item) => (
                  <SelectItem value={item.id} key={item.id}>
                    <ItemLabel itemCode={item.code} itemName={item.name} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filteredItemOptions.length > visibleItemOptions.length ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Showing first {visibleItemOptions.length} matching items in dropdown.
              </p>
            ) : null}
          </div>

          <div>
            <p className="mb-1 text-xs text-muted-foreground">Price (USD per unit)</p>
            <Input
              value={priceInput}
              onChange={(event) => setPriceInput(event.target.value)}
              placeholder="Enter price (e.g., 1.50)"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Enter dollars (for example, 0.80). The order is stored in cents.
            </p>
          </div>

          {error ? <p className="text-xs text-red-300">{error}</p> : null}

          <Button type="submit" disabled={isSubmitting || !activeCompany}>
            Submit Order
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

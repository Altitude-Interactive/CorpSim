"use client";

import { FormEvent, useMemo, useState } from "react";
import { CompanySummary, ItemCatalogItem, PlaceMarketOrderInput } from "@/lib/api";
import { parseCurrencyToCents } from "@/lib/format";
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

export function OrderPlacementCard({
  activeCompany,
  items,
  onSubmit,
  isSubmitting
}: OrderPlacementCardProps) {
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [fallbackItemId, setFallbackItemId] = useState<string>("");
  const [priceInput, setPriceInput] = useState("1.00");
  const [quantityInput, setQuantityInput] = useState("1");
  const [error, setError] = useState<string | null>(null);

  const selectedItem = useMemo(
    () => items.find((entry) => entry.id === selectedItemId) ?? null,
    [items, selectedItemId]
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!activeCompany) {
      setError("Select an active company first.");
      return;
    }

    const itemId = selectedItem?.id ?? fallbackItemId.trim();
    if (!itemId) {
      setError("Select an item or provide an item ID.");
      return;
    }

    const priceCents = parseCurrencyToCents(priceInput);
    if (!priceCents) {
      setError("Price must be greater than zero.");
      return;
    }

    const quantity = Number.parseInt(quantityInput, 10);
    if (!Number.isInteger(quantity) || quantity <= 0) {
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
              {activeCompany ? `${activeCompany.code} - ${activeCompany.name}` : "No active company"}
            </p>
            {activeCompany ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Trading region: {activeCompany.regionCode}
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
                  <SelectItem value="BUY">BUY</SelectItem>
                  <SelectItem value="SELL">SELL</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Quantity</p>
              <Input
                value={quantityInput}
                onChange={(event) => setQuantityInput(event.target.value)}
                placeholder="1"
              />
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs text-muted-foreground">Item</p>
            <Select value={selectedItemId} onValueChange={setSelectedItemId}>
              <SelectTrigger>
                <SelectValue placeholder="Select item by code/name" />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem value={item.id} key={item.id}>
                    {item.code} - {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <p className="mb-1 text-xs text-muted-foreground">Fallback Item ID</p>
            <Input
              value={fallbackItemId}
              onChange={(event) => setFallbackItemId(event.target.value)}
              placeholder="Optional itemId if not in list"
            />
          </div>

          <div>
            <p className="mb-1 text-xs text-muted-foreground">Price (USD per unit)</p>
            <Input
              value={priceInput}
              onChange={(event) => setPriceInput(event.target.value)}
              placeholder="1.00"
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

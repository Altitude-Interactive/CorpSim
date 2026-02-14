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
import { useToast } from "@/components/ui/toast";
import {
  ApiClientError,
  ContractRecord,
  ItemCatalogItem,
  acceptContract,
  fulfillContract,
  listContracts,
  listItems,
  listProductionRecipes
} from "@/lib/api";
import { UI_COPY } from "@/lib/ui-copy";
import { AvailableContractsTable } from "./available-contracts-table";
import { ContractsHistoryTable } from "./contracts-history-table";
import { MyContractsTable } from "./my-contracts-table";

type ContractsTab = "available" | "my" | "history";

const CONTRACTS_REFRESH_DEBOUNCE_MS = 500;
const CONTRACT_ITEM_SELECT_LIMIT = 200;

function mapApiError(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === 400) {
      return error.message;
    }
    if (error.status === 403) {
      return UI_COPY.common.unavailableForCompany;
    }
    if (error.status === 409) {
      return UI_COPY.common.dataChangedRetry;
    }
    return error.message;
  }

  return error instanceof Error ? error.message : "Unexpected contracts error";
}

export function ContractsPage() {
  const { showToast } = useToast();
  const { play } = useUiSfx();
  const { activeCompany, activeCompanyId } = useActiveCompany();
  const { health } = useWorldHealth();

  const [tab, setTab] = useState<ContractsTab>("available");
  const [itemFilter, setItemFilter] = useState<string>("ALL");
  const [itemSearch, setItemSearch] = useState("");
  const [items, setItems] = useState<ItemCatalogItem[]>([]);
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmittingContractId, setIsSubmittingContractId] = useState<string | null>(null);
  const [fulfillQuantityByContractId, setFulfillQuantityByContractId] = useState<
    Record<string, string>
  >({});
  const statusByContractIdRef = useRef<Map<string, ContractRecord["status"]>>(new Map());
  const didPrimeStatusesRef = useRef(false);
  const suppressEventSoundUntilRef = useRef(0);
  const deferredItemSearch = useDeferredValue(itemSearch);

  const loadItems = useCallback(async () => {
    const itemRows = await listItems();
    const unlockedRecipes = activeCompanyId ? await listProductionRecipes(activeCompanyId) : [];
    const unlockedSet = new Set<string>();
    for (const recipe of unlockedRecipes) {
      unlockedSet.add(recipe.outputItem.id);
      for (const input of recipe.inputs) {
        unlockedSet.add(input.itemId);
      }
    }

    if (unlockedSet.size === 0) {
      setItems(itemRows);
      return;
    }

    setItems(itemRows.filter((item) => unlockedSet.has(item.id)));
  }, [activeCompanyId]);

  const loadContracts = useCallback(async () => {
    setIsLoading(true);
    try {
      const rows = await listContracts({
        status: tab === "available" ? "OPEN" : undefined,
        limit: tab === "available" ? 300 : 500,
        itemId: itemFilter === "ALL" ? undefined : itemFilter
      });
      setContracts(rows);
      setError(null);
    } catch (caught) {
      setError(mapApiError(caught));
    } finally {
      setIsLoading(false);
    }
  }, [itemFilter, tab]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadItems(), loadContracts()]);
  }, [loadContracts, loadItems]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    const tick = health?.currentTick;
    if (tick === undefined) {
      return;
    }

    const timeout = setTimeout(() => {
      void loadContracts();
    }, CONTRACTS_REFRESH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [health?.currentTick, loadContracts]);

  useEffect(() => {
    if (itemFilter !== "ALL" && !items.some((item) => item.id === itemFilter)) {
      setItemFilter("ALL");
    }
  }, [itemFilter, items]);

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
    const selected =
      itemFilter !== "ALL" ? sortedItems.find((item) => item.id === itemFilter) ?? null : null;
    const head = filteredItemOptions.slice(0, CONTRACT_ITEM_SELECT_LIMIT);

    if (!selected || head.some((item) => item.id === selected.id)) {
      return head;
    }

    return [selected, ...head.slice(0, CONTRACT_ITEM_SELECT_LIMIT - 1)];
  }, [filteredItemOptions, itemFilter, sortedItems]);

  useEffect(() => {
    statusByContractIdRef.current = new Map();
    didPrimeStatusesRef.current = false;
  }, [activeCompanyId]);

  useEffect(() => {
    const next = new Map(contracts.map((contract) => [contract.id, contract.status] as const));
    if (!didPrimeStatusesRef.current) {
      statusByContractIdRef.current = next;
      didPrimeStatusesRef.current = true;
      return;
    }

    let hasUpdate = false;
    for (const [contractId, nextStatus] of next.entries()) {
      const previousStatus = statusByContractIdRef.current.get(contractId);
      if (
        previousStatus &&
        previousStatus !== nextStatus &&
        (nextStatus === "ACCEPTED" ||
          nextStatus === "PARTIALLY_FULFILLED" ||
          nextStatus === "FULFILLED" ||
          nextStatus === "EXPIRED" ||
          nextStatus === "CANCELLED")
      ) {
        hasUpdate = true;
        break;
      }
    }
    if (hasUpdate && Date.now() >= suppressEventSoundUntilRef.current) {
      play("event_contract_update");
    }
    statusByContractIdRef.current = next;
  }, [contracts, play]);

  const availableContracts = useMemo(
    () => contracts.filter((contract) => contract.status === "OPEN"),
    [contracts]
  );

  const myContracts = useMemo(
    () =>
      contracts.filter(
        (contract) =>
          contract.sellerCompanyId === activeCompanyId &&
          (contract.status === "ACCEPTED" || contract.status === "PARTIALLY_FULFILLED")
      ),
    [contracts, activeCompanyId]
  );

  const historyContracts = useMemo(
    () =>
      contracts.filter(
        (contract) =>
          contract.sellerCompanyId === activeCompanyId &&
          (contract.status === "FULFILLED" ||
            contract.status === "EXPIRED" ||
            contract.status === "CANCELLED")
      ),
    [contracts, activeCompanyId]
  );

  const handleAccept = async (contract: ContractRecord) => {
    if (!activeCompanyId) {
      showToast({
        title: "Company required",
        description: UI_COPY.common.selectCompanyFirst,
        variant: "error"
      });
      return;
    }

    setIsSubmittingContractId(contract.id);
    try {
      await acceptContract(contract.id, activeCompanyId);
      play("action_contract_accept");
      showToast({
        title: "Contract accepted",
        description: "The contract is now active in your queue.",
        variant: "success",
        sound: "none"
      });
      suppressEventSoundUntilRef.current = Date.now() + 1_500;
      await loadContracts();
    } catch (caught) {
      showToast({
        title: "Accept failed",
        description: mapApiError(caught),
        variant: "error"
      });
    } finally {
      setIsSubmittingContractId(null);
    }
  };

  const handleFulfill = async (contract: ContractRecord) => {
    if (!activeCompanyId) {
      showToast({
        title: "Company required",
        description: UI_COPY.common.selectCompanyFirst,
        variant: "error"
      });
      return;
    }

    const rawQuantity =
      fulfillQuantityByContractId[contract.id] ?? String(contract.remainingQuantity);
    const parsedQuantity = Number.parseInt(rawQuantity, 10);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      showToast({
        title: "Invalid quantity",
        description: "Fulfillment quantity must be a positive integer.",
        variant: "error"
      });
      return;
    }

    setIsSubmittingContractId(contract.id);
    try {
      await fulfillContract(contract.id, activeCompanyId, parsedQuantity);
      play("action_contract_fulfill");
      showToast({
        title: "Contract fulfilled",
        description: `Delivered ${parsedQuantity} unit(s).`,
        variant: "success",
        sound: "none"
      });
      suppressEventSoundUntilRef.current = Date.now() + 1_500;
      await loadContracts();
    } catch (caught) {
      showToast({
        title: "Fulfill failed",
        description: mapApiError(caught),
        variant: "error"
      });
    } finally {
      setIsSubmittingContractId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Contracts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={tab === "available" ? "default" : "outline"}
              onClick={() => setTab("available")}
            >
              Available
            </Button>
            <Button variant={tab === "my" ? "default" : "outline"} onClick={() => setTab("my")}>
              My Contracts
            </Button>
            <Button
              variant={tab === "history" ? "default" : "outline"}
              onClick={() => setTab("history")}
            >
              History
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-[320px_320px_minmax(0,1fr)]">
            <Input
              value={itemSearch}
              onChange={(event) => setItemSearch(event.target.value)}
              placeholder="Search item filter by code or name"
            />
            <div className="space-y-1">
              <Select value={itemFilter} onValueChange={setItemFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by item" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All items</SelectItem>
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
            <p className="self-center text-sm text-muted-foreground">
              Active company:{" "}
              {activeCompany ? activeCompany.name : UI_COPY.common.noCompanySelected}
            </p>
          </div>
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
        </CardContent>
      </Card>

      {tab === "available" ? (
        <AvailableContractsTable
          contracts={availableContracts}
          currentTick={health?.currentTick}
          isLoading={isLoading}
          isSubmittingContractId={isSubmittingContractId}
          onAccept={(contract) => {
            void handleAccept(contract);
          }}
        />
      ) : null}

      {tab === "my" ? (
        <MyContractsTable
          contracts={myContracts}
          isLoading={isLoading}
          isSubmittingContractId={isSubmittingContractId}
          fulfillQuantityByContractId={fulfillQuantityByContractId}
          onFulfillQuantityChange={(contractId, value) =>
            setFulfillQuantityByContractId((current) => ({ ...current, [contractId]: value }))
          }
          onFulfill={(contract) => {
            void handleFulfill(contract);
          }}
        />
      ) : null}

      {tab === "history" ? (
        <ContractsHistoryTable contracts={historyContracts} isLoading={isLoading} />
      ) : null}
    </div>
  );
}

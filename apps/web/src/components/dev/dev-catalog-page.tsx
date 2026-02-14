"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { getIconCatalogItemByCode } from "@corpsim/shared";
import { ItemLabel } from "@/components/items/item-label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CompanySummary,
  ItemCatalogItem,
  ProductionRecipe,
  RegionSummary,
  ResearchNode,
  WorldHealth,
  advanceWorld,
  getWorldHealth,
  listCompanies,
  listItems,
  listProductionRecipes,
  listRegions,
  listResearch,
  resetWorld
} from "@/lib/api";
import { formatCents } from "@/lib/format";
import { formatCodeLabel } from "@/lib/ui-copy";
import { formatCadenceCount, UI_CADENCE_TERMS } from "@/lib/ui-terms";

interface ItemUsageSummary {
  inputRecipeCount: number;
  outputRecipeCount: number;
}

interface CatalogSnapshot {
  loadedAt: string;
  health: WorldHealth | null;
  regions: RegionSummary[];
  companies: CompanySummary[];
  items: ItemCatalogItem[];
  recipes: ProductionRecipe[];
  researchNodes: ResearchNode[];
  researchCompanyId: string | null;
}

interface CatalogConsistencyIssue {
  id: string;
  message: string;
}

interface ItemCatalogRow {
  item: ItemCatalogItem;
  usage: ItemUsageSummary | undefined;
  meta: ItemIconMeta;
  searchText: string;
}

interface ItemIconMeta {
  source: "BASE" | "ICON";
  series: number | null;
  tier: number | null;
}

const ITEM_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
const RECIPE_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
const RESEARCH_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

function mapStatusVariant(
  status: ResearchNode["status"]
): "success" | "warning" | "info" | "muted" {
  if (status === "COMPLETED") {
    return "success";
  }
  if (status === "RESEARCHING") {
    return "info";
  }
  if (status === "AVAILABLE") {
    return "warning";
  }
  return "muted";
}

async function loadResearchNodesWithFallback(
  companies: CompanySummary[]
): Promise<{ researchNodes: ResearchNode[]; researchCompanyId: string | null; error: string | null }> {
  if (companies.length === 0) {
    try {
      const nodes = await listResearch();
      return { researchNodes: nodes, researchCompanyId: null, error: null };
    } catch (error) {
      return {
        researchNodes: [],
        researchCompanyId: null,
        error: error instanceof Error ? error.message : "Failed to load research nodes"
      };
    }
  }

  const preferredCompanyId = companies[0].id;
  try {
    const nodes = await listResearch(preferredCompanyId);
    return { researchNodes: nodes, researchCompanyId: preferredCompanyId, error: null };
  } catch (firstError) {
    try {
      const nodes = await listResearch();
      return { researchNodes: nodes, researchCompanyId: null, error: null };
    } catch (secondError) {
      const firstMessage = firstError instanceof Error ? firstError.message : "Unknown error";
      const secondMessage = secondError instanceof Error ? secondError.message : "Unknown error";
      return {
        researchNodes: [],
        researchCompanyId: null,
        error: `Failed to load research nodes (${firstMessage}; fallback: ${secondMessage})`
      };
    }
  }
}

export function DevCatalogPage() {
  const [snapshot, setSnapshot] = useState<CatalogSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [itemSearch, setItemSearch] = useState("");
  const [itemSourceFilter, setItemSourceFilter] = useState<"ALL" | "BASE" | "ICON">("ALL");
  const [itemTierFilter, setItemTierFilter] = useState<"ALL" | "1" | "2" | "3" | "4">("ALL");
  const [itemPageSize, setItemPageSize] =
    useState<(typeof ITEM_PAGE_SIZE_OPTIONS)[number]>(20);
  const [itemPage, setItemPage] = useState(1);
  const [recipeSearch, setRecipeSearch] = useState("");
  const [recipePageSize, setRecipePageSize] =
    useState<(typeof RECIPE_PAGE_SIZE_OPTIONS)[number]>(20);
  const [recipePage, setRecipePage] = useState(1);
  const [researchSearch, setResearchSearch] = useState("");
  const [researchStatusFilter, setResearchStatusFilter] =
    useState<"ALL" | ResearchNode["status"]>("ALL");
  const [researchPageSize, setResearchPageSize] =
    useState<(typeof RESEARCH_PAGE_SIZE_OPTIONS)[number]>(20);
  const [researchPage, setResearchPage] = useState(1);
  const [isConsistencyCheckEnabled, setIsConsistencyCheckEnabled] = useState(false);
  const [ticksInput, setTicksInput] = useState("1");
  const [controlsError, setControlsError] = useState<string | null>(null);
  const [controlsMessage, setControlsMessage] = useState<string | null>(null);
  const [isControlSubmitting, setIsControlSubmitting] = useState(false);
  const deferredItemSearch = useDeferredValue(itemSearch);
  const deferredRecipeSearch = useDeferredValue(recipeSearch);
  const deferredResearchSearch = useDeferredValue(researchSearch);

  const loadSnapshot = useCallback(async () => {
    setIsLoading(true);
    try {
      const [health, regions, companies, items, recipes] = await Promise.all([
        getWorldHealth(),
        listRegions(),
        listCompanies(),
        listItems(),
        listProductionRecipes()
      ]);

      const researchResult = await loadResearchNodesWithFallback(companies);
      setSnapshot({
        loadedAt: new Date().toISOString(),
        health,
        regions,
        companies,
        items,
        recipes,
        researchNodes: researchResult.researchNodes,
        researchCompanyId: researchResult.researchCompanyId
      });
      setResearchError(researchResult.error);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load development catalog");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  const runAdvance = useCallback(async () => {
    const parsed = Number.parseInt(ticksInput, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setControlsError(`${UI_CADENCE_TERMS.pluralTitle} must be a positive integer.`);
      setControlsMessage(null);
      return;
    }

    if (parsed > 10) {
      const confirmed = window.confirm(
        `Advance by ${formatCadenceCount(parsed)}? This may process many events.`
      );
      if (!confirmed) {
        return;
      }
    }

    setIsControlSubmitting(true);
    try {
      await advanceWorld(parsed);
      setControlsError(null);
      setControlsMessage(`Advanced ${formatCadenceCount(parsed)}.`);
      await loadSnapshot();
    } catch (caught) {
      setControlsMessage(null);
      setControlsError(caught instanceof Error ? caught.message : "Failed to advance world");
    } finally {
      setIsControlSubmitting(false);
    }
  }, [loadSnapshot, ticksInput]);

  const runReset = useCallback(async () => {
    const confirmed = window.confirm(
      "Reset world and reseed? This will wipe current simulation state."
    );
    if (!confirmed) {
      return;
    }

    setIsControlSubmitting(true);
    try {
      await resetWorld(true);
      setControlsError(null);
      setControlsMessage("Simulation reset and reseeded.");
      await loadSnapshot();
    } catch (caught) {
      setControlsMessage(null);
      setControlsError(caught instanceof Error ? caught.message : "Failed to reset world");
    } finally {
      setIsControlSubmitting(false);
    }
  }, [loadSnapshot]);

  const itemUsageById = useMemo(() => {
    if (!snapshot) {
      return new Map<string, ItemUsageSummary>();
    }

    const usage = new Map<string, ItemUsageSummary>();
    for (const item of snapshot.items) {
      usage.set(item.id, {
        inputRecipeCount: 0,
        outputRecipeCount: 0
      });
    }

    for (const recipe of snapshot.recipes) {
      const output = usage.get(recipe.outputItem.id);
      if (output) {
        output.outputRecipeCount += 1;
      }

      for (const input of recipe.inputs) {
        const row = usage.get(input.itemId);
        if (!row) {
          continue;
        }
        row.inputRecipeCount += 1;
      }
    }

    return usage;
  }, [snapshot]);

  const itemMetaById = useMemo(() => {
    const rows = new Map<string, ItemIconMeta>();
    if (!snapshot) {
      return rows;
    }

    for (const item of snapshot.items) {
      const iconCatalogItem = getIconCatalogItemByCode(item.code);
      if (!iconCatalogItem) {
        rows.set(item.id, { source: "BASE", series: null, tier: null });
        continue;
      }

      rows.set(item.id, {
        source: "ICON",
        series: iconCatalogItem.series,
        tier: iconCatalogItem.tier
      });
    }

    return rows;
  }, [snapshot]);

  const itemRows = useMemo(() => {
    if (!snapshot) {
      return [] as ItemCatalogRow[];
    }

    return snapshot.items.map((item) => ({
      item,
      usage: itemUsageById.get(item.id),
      meta: itemMetaById.get(item.id) ?? { source: "BASE", series: null, tier: null },
      searchText: `${item.code} ${item.name}`.toLowerCase()
    }));
  }, [itemMetaById, itemUsageById, snapshot]);

  const filteredItems = useMemo(() => {
    const needle = deferredItemSearch.trim().toLowerCase();

    return itemRows.filter((row) => {
      const meta = row.meta;

      if (needle.length > 0) {
        if (!row.searchText.includes(needle)) {
          return false;
        }
      }

      if (itemSourceFilter !== "ALL" && meta.source !== itemSourceFilter) {
        return false;
      }

      if (itemTierFilter !== "ALL") {
        const desiredTier = Number.parseInt(itemTierFilter, 10);
        if (meta.tier !== desiredTier) {
          return false;
        }
      }

      return true;
    });
  }, [deferredItemSearch, itemRows, itemSourceFilter, itemTierFilter]);

  useEffect(() => {
    setItemPage(1);
  }, [itemSearch, itemSourceFilter, itemTierFilter, itemPageSize]);

  const totalItemPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredItems.length / itemPageSize));
  }, [filteredItems.length, itemPageSize]);

  useEffect(() => {
    if (itemPage > totalItemPages) {
      setItemPage(totalItemPages);
    }
  }, [itemPage, totalItemPages]);

  const pagedItems = useMemo(() => {
    const start = (itemPage - 1) * itemPageSize;
    return filteredItems.slice(start, start + itemPageSize);
  }, [filteredItems, itemPage, itemPageSize]);

  const itemRangeLabel = useMemo(() => {
    if (filteredItems.length === 0) {
      return "0-0";
    }

    const start = (itemPage - 1) * itemPageSize + 1;
    const end = Math.min(itemPage * itemPageSize, filteredItems.length);
    return `${start}-${end}`;
  }, [filteredItems.length, itemPage, itemPageSize]);

  const filteredRecipes = useMemo(() => {
    if (!snapshot) {
      return [] as ProductionRecipe[];
    }

    const needle = deferredRecipeSearch.trim().toLowerCase();
    if (!needle) {
      return snapshot.recipes;
    }

    return snapshot.recipes.filter((recipe) => {
      const inputNames = recipe.inputs.map((input) => input.item.name).join(" ");
      const haystack =
        `${recipe.code} ${recipe.name} ${recipe.outputItem.code} ${recipe.outputItem.name} ${inputNames}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [deferredRecipeSearch, snapshot]);

  useEffect(() => {
    setRecipePage(1);
  }, [recipeSearch, recipePageSize]);

  const totalRecipePages = useMemo(
    () => Math.max(1, Math.ceil(filteredRecipes.length / recipePageSize)),
    [filteredRecipes.length, recipePageSize]
  );

  useEffect(() => {
    if (recipePage > totalRecipePages) {
      setRecipePage(totalRecipePages);
    }
  }, [recipePage, totalRecipePages]);

  const pagedRecipes = useMemo(() => {
    const start = (recipePage - 1) * recipePageSize;
    return filteredRecipes.slice(start, start + recipePageSize);
  }, [filteredRecipes, recipePage, recipePageSize]);

  const recipeRangeLabel = useMemo(() => {
    if (filteredRecipes.length === 0) {
      return "0-0";
    }

    const start = (recipePage - 1) * recipePageSize + 1;
    const end = Math.min(recipePage * recipePageSize, filteredRecipes.length);
    return `${start}-${end}`;
  }, [filteredRecipes.length, recipePage, recipePageSize]);

  const filteredResearchNodes = useMemo(() => {
    if (!snapshot) {
      return [] as ResearchNode[];
    }

    const needle = deferredResearchSearch.trim().toLowerCase();

    return snapshot.researchNodes.filter((node) => {
      if (researchStatusFilter !== "ALL" && node.status !== researchStatusFilter) {
        return false;
      }

      if (!needle) {
        return true;
      }

      const haystack = `${node.code} ${node.name} ${node.description}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [deferredResearchSearch, researchStatusFilter, snapshot]);

  useEffect(() => {
    setResearchPage(1);
  }, [researchSearch, researchStatusFilter, researchPageSize]);

  const totalResearchPages = useMemo(
    () => Math.max(1, Math.ceil(filteredResearchNodes.length / researchPageSize)),
    [filteredResearchNodes.length, researchPageSize]
  );

  useEffect(() => {
    if (researchPage > totalResearchPages) {
      setResearchPage(totalResearchPages);
    }
  }, [researchPage, totalResearchPages]);

  const pagedResearchNodes = useMemo(() => {
    const start = (researchPage - 1) * researchPageSize;
    return filteredResearchNodes.slice(start, start + researchPageSize);
  }, [filteredResearchNodes, researchPage, researchPageSize]);

  const researchRangeLabel = useMemo(() => {
    if (filteredResearchNodes.length === 0) {
      return "0-0";
    }

    const start = (researchPage - 1) * researchPageSize + 1;
    const end = Math.min(researchPage * researchPageSize, filteredResearchNodes.length);
    return `${start}-${end}`;
  }, [filteredResearchNodes.length, researchPage, researchPageSize]);

  const consistencyIssues = useMemo(() => {
    if (!snapshot || !isConsistencyCheckEnabled) {
      return [] as CatalogConsistencyIssue[];
    }

    const issues: CatalogConsistencyIssue[] = [];
    const itemIds = new Set(snapshot.items.map((item) => item.id));
    const recipeCodes = new Set(snapshot.recipes.map((recipe) => recipe.code));
    const researchIds = new Set(snapshot.researchNodes.map((node) => node.id));

    const itemCodeCounts = new Map<string, number>();
    for (const item of snapshot.items) {
      itemCodeCounts.set(item.code, (itemCodeCounts.get(item.code) ?? 0) + 1);
    }
    for (const [code, count] of itemCodeCounts.entries()) {
      if (count > 1) {
        issues.push({
          id: `item-code-${code}`,
          message: `Duplicate item code detected: ${code} (${count})`
        });
      }
    }

    const recipeCodeCounts = new Map<string, number>();
    for (const recipe of snapshot.recipes) {
      recipeCodeCounts.set(recipe.code, (recipeCodeCounts.get(recipe.code) ?? 0) + 1);
    }
    for (const [code, count] of recipeCodeCounts.entries()) {
      if (count > 1) {
        issues.push({
          id: `recipe-code-${code}`,
          message: `Duplicate recipe code detected: ${code} (${count})`
        });
      }
    }

    for (const recipe of snapshot.recipes) {
      if (!itemIds.has(recipe.outputItem.id)) {
        issues.push({
          id: `recipe-output-${recipe.id}`,
          message: `Recipe ${recipe.code} outputs unknown item id ${recipe.outputItem.id}`
        });
      }

      for (const input of recipe.inputs) {
        if (!itemIds.has(input.itemId)) {
          issues.push({
            id: `recipe-input-${recipe.id}-${input.itemId}`,
            message: `Recipe ${recipe.code} references unknown input item id ${input.itemId}`
          });
        }
      }
    }

    for (const node of snapshot.researchNodes) {
      for (const unlock of node.unlockRecipes) {
        if (!recipeCodes.has(unlock.recipeCode)) {
          issues.push({
            id: `research-unlock-${node.id}-${unlock.recipeCode}`,
            message: `Research ${node.code} unlocks missing recipe code ${unlock.recipeCode}`
          });
        }
      }

      for (const prereq of node.prerequisites) {
        if (!researchIds.has(prereq.nodeId)) {
          issues.push({
            id: `research-prereq-${node.id}-${prereq.nodeId}`,
            message: `Research ${node.code} prerequisite missing node id ${prereq.nodeId}`
          });
        }
      }
    }

    return issues;
  }, [isConsistencyCheckEnabled, snapshot]);

  if (!snapshot) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Development Catalog</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Loading live game definitions and world snapshot...
            </p>
            {error ? <p className="text-sm text-red-300">{error}</p> : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void loadSnapshot();
              }}
              disabled={isLoading}
            >
              Reload
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Development Catalog</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Dynamic debug view from live API data. New items, recipes, and research definitions appear
            automatically.
          </p>
          <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-3 xl:grid-cols-6">
            <p>
              Items: <span className="tabular-nums text-foreground">{snapshot.items.length}</span>
            </p>
            <p>
              Recipes: <span className="tabular-nums text-foreground">{snapshot.recipes.length}</span>
            </p>
            <p>
              Research Nodes:{" "}
              <span className="tabular-nums text-foreground">{snapshot.researchNodes.length}</span>
            </p>
            <p>
              Regions: <span className="tabular-nums text-foreground">{snapshot.regions.length}</span>
            </p>
            <p>
              Companies:{" "}
              <span className="tabular-nums text-foreground">{snapshot.companies.length}</span>
            </p>
            <p>
              Loaded:{" "}
              <span className="text-foreground">
                {new Date(snapshot.loadedAt).toLocaleTimeString()}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void loadSnapshot();
              }}
              disabled={isLoading}
            >
              Refresh Snapshot
            </Button>
            {snapshot.health ? (
              <Badge variant={snapshot.health.invariants.hasViolations ? "warning" : "success"}>
                {snapshot.health.invariants.hasViolations
                  ? `${snapshot.health.invariants.issues.length} invariant issues`
                  : "Invariants clean"}
              </Badge>
            ) : null}
          </div>
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          {researchError ? <p className="text-sm text-yellow-300">{researchError}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>World Snapshot</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
          <p className="text-muted-foreground">
            Current Tick:{" "}
            <span className="tabular-nums text-foreground">
              {snapshot.health?.currentTick.toLocaleString() ?? "--"}
            </span>
          </p>
          <p className="text-muted-foreground">
            Lock Version:{" "}
            <span className="tabular-nums text-foreground">
              {snapshot.health?.lockVersion.toLocaleString() ?? "--"}
            </span>
          </p>
          <p className="text-muted-foreground">
            Open Orders:{" "}
            <span className="tabular-nums text-foreground">
              {snapshot.health?.ordersOpenCount.toLocaleString() ?? "--"}
            </span>
          </p>
          <p className="text-muted-foreground">
            Trades (Last 100):{" "}
            <span className="tabular-nums text-foreground">
              {snapshot.health?.tradesLast100Count.toLocaleString() ?? "--"}
            </span>
          </p>
          <p className="text-muted-foreground">
            Sum Cash:{" "}
            <span className="tabular-nums text-foreground">
              {snapshot.health ? formatCents(snapshot.health.sumCashCents) : "--"}
            </span>
          </p>
          <p className="text-muted-foreground">
            Sum Reserved Cash:{" "}
            <span className="tabular-nums text-foreground">
              {snapshot.health ? formatCents(snapshot.health.sumReservedCashCents) : "--"}
            </span>
          </p>
          <p className="text-muted-foreground">
            Companies / Bots:{" "}
            <span className="tabular-nums text-foreground">
              {snapshot.health
                ? `${snapshot.health.companiesCount.toLocaleString()} / ${snapshot.health.botsCount.toLocaleString()}`
                : "--"}
            </span>
          </p>
          <p className="text-muted-foreground">
            Research Context Company:{" "}
            <span className="text-foreground">{snapshot.researchCompanyId ?? "none"}</span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Simulation Controls (Development Only)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/20 p-3">
            <Input
              className="w-40"
              value={ticksInput}
              onChange={(event) => setTicksInput(event.target.value)}
              placeholder={UI_CADENCE_TERMS.pluralTitle}
            />
            <Button
              type="button"
              onClick={() => {
                void runAdvance();
              }}
              disabled={isControlSubmitting}
            >
              Advance {UI_CADENCE_TERMS.pluralTitle}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                void runReset();
              }}
              disabled={isControlSubmitting}
            >
              Reset + Reseed
            </Button>
          </div>
          {controlsMessage ? <p className="text-sm text-emerald-300">{controlsMessage}</p> : null}
          {controlsError ? <p className="text-sm text-red-300">{controlsError}</p> : null}
          {snapshot.health ? (
            <details className="rounded-md border border-border bg-muted/20 p-3 text-xs">
              <summary className="cursor-pointer font-medium text-muted-foreground">
                Diagnostic details
              </summary>
              <div className="mt-2 space-y-1 font-mono text-xs text-muted-foreground">
                <p>Concurrency version: {snapshot.health.lockVersion.toLocaleString()}</p>
                <p>Technical tick: {snapshot.health.currentTick.toLocaleString()}</p>
                <p>Total order records: {snapshot.health.ordersTotalCount.toLocaleString()}</p>
              </div>
            </details>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="flex flex-wrap items-end gap-2">
            <Input
              value={itemSearch}
              onChange={(event) => setItemSearch(event.target.value)}
              placeholder="Search items by code or name"
              className="w-full md:w-80"
            />
            <Select
              value={itemSourceFilter}
              onValueChange={(value) => setItemSourceFilter(value as "ALL" | "BASE" | "ICON")}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Sources</SelectItem>
                <SelectItem value="BASE">Base Items</SelectItem>
                <SelectItem value="ICON">Icon Items</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={itemTierFilter}
              onValueChange={(value) => setItemTierFilter(value as "ALL" | "1" | "2" | "3" | "4")}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Tiers</SelectItem>
                <SelectItem value="1">Tier 1</SelectItem>
                <SelectItem value="2">Tier 2</SelectItem>
                <SelectItem value="3">Tier 3</SelectItem>
                <SelectItem value="4">Tier 4</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={String(itemPageSize)}
              onValueChange={(value) =>
                setItemPageSize(Number.parseInt(value, 10) as (typeof ITEM_PAGE_SIZE_OPTIONS)[number])
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Page size" />
              </SelectTrigger>
              <SelectContent>
                {ITEM_PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size} / page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <p>
              Showing {itemRangeLabel} of {filteredItems.length} filtered items ({snapshot.items.length} total)
            </p>
            {deferredItemSearch !== itemSearch ? <p>Updating results...</p> : null}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setItemPage((page) => Math.max(1, page - 1))}
                disabled={itemPage <= 1}
              >
                Previous
              </Button>
              <span className="tabular-nums">
                Page {itemPage} / {totalItemPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setItemPage((page) => Math.min(totalItemPages, page + 1))}
                disabled={itemPage >= totalItemPages}
              >
                Next
              </Button>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Recipe Inputs</TableHead>
                <TableHead>Recipe Outputs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedItems.map((row) => {
                const { item, usage } = row;
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <ItemLabel itemCode={item.code} itemName={item.name} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{item.code}</TableCell>
                    <TableCell className="tabular-nums">{usage?.inputRecipeCount ?? 0}</TableCell>
                    <TableCell className="tabular-nums">{usage?.outputRecipeCount ?? 0}</TableCell>
                  </TableRow>
                );
              })}
              {pagedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No items found for current filters.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recipes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="flex flex-wrap items-end gap-2">
            <Input
              value={recipeSearch}
              onChange={(event) => setRecipeSearch(event.target.value)}
              placeholder="Search recipes by code, name, output, or inputs"
              className="w-full md:w-96"
            />
            <Select
              value={String(recipePageSize)}
              onValueChange={(value) =>
                setRecipePageSize(
                  Number.parseInt(value, 10) as (typeof RECIPE_PAGE_SIZE_OPTIONS)[number]
                )
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Page size" />
              </SelectTrigger>
              <SelectContent>
                {RECIPE_PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size} / page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <p>
              Showing {recipeRangeLabel} of {filteredRecipes.length} filtered recipes ({snapshot.recipes.length} total)
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRecipePage((page) => Math.max(1, page - 1))}
                disabled={recipePage <= 1}
              >
                Previous
              </Button>
              <span className="tabular-nums">
                Page {recipePage} / {totalRecipePages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRecipePage((page) => Math.min(totalRecipePages, page + 1))}
                disabled={recipePage >= totalRecipePages}
              >
                Next
              </Button>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recipe</TableHead>
                <TableHead>Output</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Inputs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedRecipes.map((recipe) => (
                <TableRow key={recipe.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <p>{recipe.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{recipe.code}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1">
                      <span>{recipe.outputQuantity}</span>
                      <ItemLabel itemCode={recipe.outputItem.code} itemName={recipe.outputItem.name} />
                    </span>
                  </TableCell>
                  <TableCell className="tabular-nums">{recipe.durationTicks}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {recipe.inputs.map((input) => (
                        <p key={`${recipe.id}-${input.itemId}`} className="inline-flex items-center gap-1">
                          <span>{input.quantityPerRun}</span>
                          <ItemLabel itemCode={input.item.code} itemName={input.item.name} />
                        </p>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {pagedRecipes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No recipes found for current filters.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Research</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="flex flex-wrap items-end gap-2">
            <Input
              value={researchSearch}
              onChange={(event) => setResearchSearch(event.target.value)}
              placeholder="Search research nodes by code, name, or description"
              className="w-full md:w-96"
            />
            <Select
              value={researchStatusFilter}
              onValueChange={(value) =>
                setResearchStatusFilter(value as "ALL" | ResearchNode["status"])
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="LOCKED">Locked</SelectItem>
                <SelectItem value="AVAILABLE">Available</SelectItem>
                <SelectItem value="RESEARCHING">Researching</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={String(researchPageSize)}
              onValueChange={(value) =>
                setResearchPageSize(
                  Number.parseInt(value, 10) as (typeof RESEARCH_PAGE_SIZE_OPTIONS)[number]
                )
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Page size" />
              </SelectTrigger>
              <SelectContent>
                {RESEARCH_PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size} / page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <p>
              Showing {researchRangeLabel} of {filteredResearchNodes.length} filtered nodes ({snapshot.researchNodes.length} total)
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setResearchPage((page) => Math.max(1, page - 1))}
                disabled={researchPage <= 1}
              >
                Previous
              </Button>
              <span className="tabular-nums">
                Page {researchPage} / {totalResearchPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setResearchPage((page) => Math.min(totalResearchPages, page + 1))}
                disabled={researchPage >= totalResearchPages}
              >
                Next
              </Button>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Node</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Prerequisites</TableHead>
                <TableHead>Unlocks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedResearchNodes.map((node) => (
                <TableRow key={node.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <p>{node.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{node.code}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={mapStatusVariant(node.status)}>{formatCodeLabel(node.status)}</Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">{formatCents(node.costCashCents)}</TableCell>
                  <TableCell className="tabular-nums">{node.durationTicks}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {node.prerequisites.length > 0
                      ? node.prerequisites.map((entry) => entry.nodeId).join(", ")
                      : "--"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {node.unlockRecipes.length > 0
                      ? node.unlockRecipes.map((entry) => entry.recipeCode).join(", ")
                      : "--"}
                  </TableCell>
                </TableRow>
              ))}
              {pagedResearchNodes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No research nodes found for current filters.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Consistency Checks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!isConsistencyCheckEnabled ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Consistency checks are disabled by default to keep this page responsive on large catalogs.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsConsistencyCheckEnabled(true)}
              >
                Run Consistency Checks
              </Button>
            </div>
          ) : consistencyIssues.length === 0 ? (
            <div className="space-y-2">
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsConsistencyCheckEnabled(false)}
                >
                  Disable Checks
                </Button>
              </div>
              <p className="text-sm text-emerald-300">No structural issues found in current snapshot.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsConsistencyCheckEnabled(false)}
                >
                  Disable Checks
                </Button>
                <p className="text-xs text-muted-foreground">
                  Showing {consistencyIssues.length} issue(s)
                </p>
              </div>
              {consistencyIssues.map((issue) => (
                <p key={issue.id} className="text-sm text-yellow-300">
                  {issue.message}
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

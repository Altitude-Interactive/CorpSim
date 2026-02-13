"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ICON_PACK_DEFINITIONS } from "@corpsim/shared";
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
  getWorldHealth,
  listCompanies,
  listItems,
  listProductionRecipes,
  listRegions,
  listResearch
} from "@/lib/api";
import { formatCents } from "@/lib/format";
import { formatCodeLabel } from "@/lib/ui-copy";

interface ItemUsageSummary {
  inputRecipeCount: number;
  outputRecipeCount: number;
  inputRecipeNames: string[];
  outputRecipeNames: string[];
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

interface ItemIconMeta {
  source: "BASE" | "ICON";
  series: number | null;
  tier: number | null;
}

const ITEM_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

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

  const itemUsageById = useMemo(() => {
    if (!snapshot) {
      return new Map<string, ItemUsageSummary>();
    }

    const usage = new Map<string, ItemUsageSummary>();
    for (const item of snapshot.items) {
      usage.set(item.id, {
        inputRecipeCount: 0,
        outputRecipeCount: 0,
        inputRecipeNames: [],
        outputRecipeNames: []
      });
    }

    for (const recipe of snapshot.recipes) {
      const output = usage.get(recipe.outputItem.id);
      if (output) {
        output.outputRecipeCount += 1;
        output.outputRecipeNames.push(recipe.name);
      }

      for (const input of recipe.inputs) {
        const row = usage.get(input.itemId);
        if (!row) {
          continue;
        }
        row.inputRecipeCount += 1;
        row.inputRecipeNames.push(recipe.name);
      }
    }

    return usage;
  }, [snapshot]);

  const iconPackCountBySeries = useMemo(
    () =>
      new Map<number, number>(
        ICON_PACK_DEFINITIONS.map((definition) => [definition.series, definition.count] as const)
      ),
    []
  );

  const itemMetaById = useMemo(() => {
    const rows = new Map<string, ItemIconMeta>();
    if (!snapshot) {
      return rows;
    }

    for (const item of snapshot.items) {
      const parsed = /^ICON_(\d{2})_(\d{2})$/.exec(item.code);
      if (!parsed) {
        rows.set(item.id, { source: "BASE", series: null, tier: null });
        continue;
      }

      const series = Number.parseInt(parsed[1], 10);
      const index = Number.parseInt(parsed[2], 10);
      const count = iconPackCountBySeries.get(series) ?? 40;
      const tierSize = Math.max(1, Math.ceil(count / 4));
      const tier = Math.max(1, Math.min(4, Math.floor((index - 1) / tierSize) + 1));

      rows.set(item.id, {
        source: "ICON",
        series,
        tier
      });
    }

    return rows;
  }, [iconPackCountBySeries, snapshot]);

  const filteredItems = useMemo(() => {
    if (!snapshot) {
      return [] as ItemCatalogItem[];
    }

    const needle = itemSearch.trim().toLowerCase();

    return snapshot.items.filter((item) => {
      const usage = itemUsageById.get(item.id);
      const meta = itemMetaById.get(item.id) ?? { source: "BASE", series: null, tier: null };

      if (needle.length > 0) {
        const haystack = `${item.code} ${item.name}`.toLowerCase();
        if (!haystack.includes(needle)) {
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

      return Boolean(usage);
    });
  }, [itemMetaById, itemSearch, itemSourceFilter, itemTierFilter, itemUsageById, snapshot]);

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

  const consistencyIssues = useMemo(() => {
    if (!snapshot) {
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
  }, [snapshot]);

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
              {pagedItems.map((item) => {
                const usage = itemUsageById.get(item.id);
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
        <CardContent className="pt-0">
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
              {snapshot.recipes.map((recipe) => (
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
              {snapshot.recipes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No recipes found.
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
        <CardContent className="pt-0">
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
              {snapshot.researchNodes.map((node) => (
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
              {snapshot.researchNodes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No research nodes found.
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
          {consistencyIssues.length === 0 ? (
            <p className="text-sm text-emerald-300">No structural issues found in current snapshot.</p>
          ) : (
            consistencyIssues.map((issue) => (
              <p key={issue.id} className="text-sm text-yellow-300">
                {issue.message}
              </p>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

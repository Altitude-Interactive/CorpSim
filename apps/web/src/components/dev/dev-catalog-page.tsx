"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ItemLabel } from "@/components/items/item-label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        <CardContent className="pt-0">
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
              {snapshot.items.map((item) => {
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
              {snapshot.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No items found.
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

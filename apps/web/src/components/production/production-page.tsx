"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useActiveCompany } from "@/components/company/active-company-provider";
import { ItemLabel } from "@/components/items/item-label";
import { useWorldHealth } from "@/components/layout/world-health-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import {
  ApiClientError,
  ProductionJob,
  ProductionRecipe,
  cancelProductionJob,
  createProductionJob,
  listProductionJobs,
  listProductionRecipes
} from "@/lib/api";
import { formatCadenceCount, UI_CADENCE_TERMS } from "@/lib/ui-terms";
import { formatCodeLabel, UI_COPY } from "@/lib/ui-copy";

const PRODUCTION_REFRESH_DEBOUNCE_MS = 500;

function mapProductionStatusVariant(status: ProductionJob["status"]): "success" | "warning" | "info" {
  if (status === "COMPLETED") {
    return "success";
  }
  if (status === "CANCELLED") {
    return "warning";
  }
  return "info";
}

function mapProductionErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === 400) {
      return error.message;
    }
    if (error.status === 404) {
      return UI_COPY.common.recordNotFound;
    }
    return error.message;
  }

  return error instanceof Error ? error.message : "Unexpected error";
}

export function ProductionPage() {
  const { showToast } = useToast();
  const { activeCompany, activeCompanyId } = useActiveCompany();
  const { health } = useWorldHealth();

  const [recipes, setRecipes] = useState<ProductionRecipe[]>([]);
  const [runningJobs, setRunningJobs] = useState<ProductionJob[]>([]);
  const [completedJobs, setCompletedJobs] = useState<ProductionJob[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>("");
  const [quantityInput, setQuantityInput] = useState("1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancellingJobId, setIsCancellingJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === selectedRecipeId) ?? null,
    [recipes, selectedRecipeId]
  );

  const loadRecipes = useCallback(async () => {
    const rows = await listProductionRecipes();
    setRecipes(rows);
    setSelectedRecipeId((current) => {
      if (current && rows.some((recipe) => recipe.id === current)) {
        return current;
      }
      return rows[0]?.id ?? "";
    });
  }, []);

  const loadJobs = useCallback(async () => {
    if (!activeCompanyId) {
      setRunningJobs([]);
      setCompletedJobs([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [running, completed] = await Promise.all([
        listProductionJobs({
          companyId: activeCompanyId,
          status: "RUNNING",
          limit: 100
        }),
        listProductionJobs({
          companyId: activeCompanyId,
          status: "COMPLETED",
          limit: 100
        })
      ]);

      setRunningJobs(running);
      setCompletedJobs(completed);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load production jobs");
    } finally {
      setIsLoading(false);
    }
  }, [activeCompanyId]);

  const loadProductionState = useCallback(async () => {
    try {
      await Promise.all([loadRecipes(), loadJobs()]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load production state");
    }
  }, [loadJobs, loadRecipes]);

  useEffect(() => {
    void loadProductionState();
  }, [loadProductionState]);

  useEffect(() => {
    const tick = health?.currentTick;
    if (tick === undefined) {
      return;
    }

    const timeout = setTimeout(() => {
      void loadJobs();
    }, PRODUCTION_REFRESH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [health?.currentTick, loadJobs]);

  const submitStartJob = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!activeCompanyId) {
      setError(UI_COPY.common.selectCompanyFirst);
      return;
    }
    if (!selectedRecipeId) {
      setError("Select a recipe first.");
      return;
    }

    const quantity = Number.parseInt(quantityInput, 10);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setError("Quantity must be a positive integer.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createProductionJob({
        companyId: activeCompanyId,
        recipeId: selectedRecipeId,
        quantity
      });
      setError(null);
      showToast({
        title: "Production started",
        description: `Started ${quantity} run(s).`,
        variant: "success"
      });
      await loadJobs();
    } catch (caught) {
      const message = mapProductionErrorMessage(caught);
      setError(message);
      showToast({
        title: "Production start failed",
        description: message,
        variant: "error"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    setIsCancellingJobId(jobId);
    try {
      const job = await cancelProductionJob(jobId);
      if (job.status === "CANCELLED") {
        showToast({
          title: "Job cancelled",
          description: "The production run was cancelled.",
          variant: "success"
        });
      } else {
        showToast({
          title: "Job already finalized",
          description: `Status is ${formatCodeLabel(job.status)}.`,
          variant: "info"
        });
      }
      await loadJobs();
    } catch (caught) {
      const message = mapProductionErrorMessage(caught);
      setError(message);
      showToast({
        title: "Cancel failed",
        description: message,
        variant: "error"
      });
    } finally {
      setIsCancellingJobId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Start Production</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={submitStartJob}>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Active Company</p>
                <p className="text-sm font-medium">
                  {activeCompany ? activeCompany.name : UI_COPY.common.noCompanySelected}
                </p>
              </div>

              <div>
                <p className="mb-1 text-xs text-muted-foreground">Recipe</p>
                <Select value={selectedRecipeId} onValueChange={setSelectedRecipeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select recipe" />
                  </SelectTrigger>
                  <SelectContent>
                    {recipes.map((recipe) => (
                      <SelectItem key={recipe.id} value={recipe.id}>
                        {recipe.name}
                      </SelectItem>
                    ))}
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

              {selectedRecipe ? (
                <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">{selectedRecipe.name}</p>
                  <p>
                    Duration: {formatCadenceCount(selectedRecipe.durationTicks)} / run
                  </p>
                  <p>
                    Output: {selectedRecipe.outputQuantity}{" "}
                    <ItemLabel
                      itemCode={selectedRecipe.outputItem.code}
                      itemName={selectedRecipe.outputItem.name}
                      className="inline-flex"
                    />
                  </p>
                  <p>Inputs:</p>
                  <ul className="list-disc pl-4">
                    {selectedRecipe.inputs.map((input) => (
                      <li key={input.itemId} className="flex items-center gap-1">
                        <span>{input.quantityPerRun}</span>
                        <ItemLabel itemCode={input.item.code} itemName={input.item.name} />
                        <span>/ run</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <Button type="submit" disabled={isSubmitting || !activeCompanyId || !selectedRecipeId}>
                Start Job
              </Button>
              {error ? <p className="text-xs text-red-300">{error}</p> : null}
            </form>
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
                {recipes.map((recipe) => (
                  <TableRow key={recipe.id}>
                    <TableCell>
                      <p className="font-medium">{recipe.name}</p>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1">
                        <span>{recipe.outputQuantity}</span>
                        <ItemLabel
                          itemCode={recipe.outputItem.code}
                          itemName={recipe.outputItem.name}
                        />
                      </span>
                    </TableCell>
                    <TableCell>{formatCadenceCount(recipe.durationTicks)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {recipe.inputs.map((input) => (
                          <span key={input.itemId} className="inline-flex items-center gap-1">
                            <span>{input.quantityPerRun}</span>
                            <ItemLabel itemCode={input.item.code} itemName={input.item.name} />
                          </span>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {recipes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No recipes available.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Running Jobs</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recipe</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>{`Started ${UI_CADENCE_TERMS.singularTitle}`}</TableHead>
                <TableHead>{`Expected Completion ${UI_CADENCE_TERMS.singularTitle}`}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {runningJobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>
                    <p>{job.recipe.name}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={mapProductionStatusVariant(job.status)}>
                      {formatCodeLabel(job.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">{job.quantity}</TableCell>
                  <TableCell className="tabular-nums">{job.tickStarted}</TableCell>
                  <TableCell className="tabular-nums">{job.tickCompletionExpected}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isCancellingJobId === job.id}
                      onClick={() => {
                        void handleCancelJob(job.id);
                      }}
                    >
                      Cancel
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && runningJobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No running production jobs.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Completed Recently</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recipe</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>{`Completed ${UI_CADENCE_TERMS.singularTitle}`}</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {completedJobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>
                    <p>{job.recipe.name}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={mapProductionStatusVariant(job.status)}>
                      {formatCodeLabel(job.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">{job.quantity}</TableCell>
                  <TableCell className="tabular-nums">{job.tickCompleted ?? "-"}</TableCell>
                  <TableCell>{new Date(job.updatedAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {!isLoading && completedJobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No completed jobs yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

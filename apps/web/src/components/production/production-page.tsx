"use client";

import { FormEvent, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { useActiveCompany } from "@/components/company/active-company-provider";
import { ItemLabel } from "@/components/items/item-label";
import { useWorldHealth } from "@/components/layout/world-health-provider";
import { useUiSfx } from "@/components/layout/ui-sfx-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DeferredSearchStatus } from "@/components/ui/deferred-search-status";
import { TableSkeletonRows } from "@/components/ui/table-skeleton-rows";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast-manager";
import {
  ApiClientError,
  CompanySpecialization,
  CompanySpecializationOption,
  ProductionJob,
  ProductionRecipe,
  cancelProductionJob,
  createProductionJob,
  listCompanySpecializations,
  listProductionJobs,
  listProductionRecipes,
  setCompanySpecialization
} from "@/lib/api";
import { formatCadenceCount, UI_CADENCE_TERMS } from "@/lib/ui-terms";
import { formatCodeLabel, UI_COPY } from "@/lib/ui-copy";
import { cn } from "@/lib/utils";

const PRODUCTION_REFRESH_DEBOUNCE_MS = 500;
const PRODUCTION_RECIPE_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

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
  const { play } = useUiSfx();
  const { activeCompany, activeCompanyId, refreshCompanies } = useActiveCompany();
  const { health } = useWorldHealth();

  const [recipes, setRecipes] = useState<ProductionRecipe[]>([]);
  const [runningJobs, setRunningJobs] = useState<ProductionJob[]>([]);
  const [completedJobs, setCompletedJobs] = useState<ProductionJob[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>("");
  const [recipeSearch, setRecipeSearch] = useState("");
  const [recipePage, setRecipePage] = useState(1);
  const [recipePageSize, setRecipePageSize] =
    useState<(typeof PRODUCTION_RECIPE_PAGE_SIZE_OPTIONS)[number]>(10);
  const [quantityInput, setQuantityInput] = useState("1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingRecipes, setIsLoadingRecipes] = useState(true);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [hasLoadedRecipes, setHasLoadedRecipes] = useState(false);
  const [hasLoadedJobs, setHasLoadedJobs] = useState(false);
  const [specializationOptions, setSpecializationOptions] = useState<CompanySpecializationOption[]>([]);
  const [isLoadingSpecializations, setIsLoadingSpecializations] = useState(true);
  const [isUpdatingSpecialization, setIsUpdatingSpecialization] = useState(false);
  const [isFocusPickerOpen, setIsFocusPickerOpen] = useState(false);
  const [isCancellingJobId, setIsCancellingJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deferredRecipeSearch = useDeferredValue(recipeSearch);
  const completedJobIdsRef = useRef<Set<string>>(new Set());
  const didPrimeCompletedRef = useRef(false);
  const hasLoadedRecipesRef = useRef(false);
  const hasLoadedJobsRef = useRef(false);

  const selectedRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === selectedRecipeId) ?? null,
    [recipes, selectedRecipeId]
  );

  const recipeRows = useMemo(() => {
    return recipes.map((recipe) => {
      const inputNames = recipe.inputs.map((input) => input.item.name).join(" ");
      return {
        recipe,
        searchText:
          `${recipe.code} ${recipe.name} ${recipe.outputItem.code} ${recipe.outputItem.name} ${inputNames}`.toLowerCase()
      };
    });
  }, [recipes]);

  const filteredRecipeRows = useMemo(() => {
    const needle = deferredRecipeSearch.trim().toLowerCase();
    if (!needle) {
      return recipeRows;
    }

    return recipeRows.filter((row) => row.searchText.includes(needle));
  }, [deferredRecipeSearch, recipeRows]);

  useEffect(() => {
    setRecipePage(1);
  }, [recipeSearch, recipePageSize]);

  const totalRecipePages = useMemo(
    () => Math.max(1, Math.ceil(filteredRecipeRows.length / recipePageSize)),
    [filteredRecipeRows.length, recipePageSize]
  );

  useEffect(() => {
    if (recipePage > totalRecipePages) {
      setRecipePage(totalRecipePages);
    }
  }, [recipePage, totalRecipePages]);

  const pagedRecipeRows = useMemo(() => {
    const start = (recipePage - 1) * recipePageSize;
    return filteredRecipeRows.slice(start, start + recipePageSize);
  }, [filteredRecipeRows, recipePage, recipePageSize]);

  const recipeRangeLabel = useMemo(() => {
    if (filteredRecipeRows.length === 0) {
      return "0-0";
    }

    const start = (recipePage - 1) * recipePageSize + 1;
    const end = Math.min(recipePage * recipePageSize, filteredRecipeRows.length);
    return `${start}-${end}`;
  }, [filteredRecipeRows.length, recipePage, recipePageSize]);

  const selectRecipeRows = useMemo(() => {
    const MAX_SELECT_OPTIONS = 200;
    const selected = recipeRows.find((row) => row.recipe.id === selectedRecipeId);
    const head = filteredRecipeRows.slice(0, MAX_SELECT_OPTIONS);

    if (!selected || head.some((row) => row.recipe.id === selected.recipe.id)) {
      return head;
    }

    return [selected, ...head.slice(0, MAX_SELECT_OPTIONS - 1)];
  }, [filteredRecipeRows, recipeRows, selectedRecipeId]);

  const nextRunningCompletionTick = useMemo(() => {
    if (runningJobs.length === 0) {
      return null;
    }

    return runningJobs.reduce<number>(
      (minTick, job) => Math.min(minTick, job.tickCompletionExpected),
      Number.MAX_SAFE_INTEGER
    );
  }, [runningJobs]);

  const activeSpecializationOption = useMemo(
    () =>
      specializationOptions.find((option) => option.code === activeCompany?.specialization) ?? null,
    [activeCompany?.specialization, specializationOptions]
  );

  const loadRecipes = useCallback(async (options?: { showLoadingState?: boolean }) => {
    const showLoadingState = options?.showLoadingState ?? !hasLoadedRecipesRef.current;
    if (!activeCompanyId) {
      setRecipes([]);
      setSelectedRecipeId("");
      if (showLoadingState) {
        setIsLoadingRecipes(false);
      }
      if (!hasLoadedRecipesRef.current) {
        hasLoadedRecipesRef.current = true;
        setHasLoadedRecipes(true);
      }
      return;
    }

    if (showLoadingState) {
      setIsLoadingRecipes(true);
    }
    try {
      const rows = await listProductionRecipes(activeCompanyId);
      setRecipes(rows);
      setSelectedRecipeId((current) => {
        if (current && rows.some((recipe) => recipe.id === current)) {
          return current;
        }
        return rows[0]?.id ?? "";
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load production recipes");
    } finally {
      if (showLoadingState) {
        setIsLoadingRecipes(false);
      }
      if (!hasLoadedRecipesRef.current) {
        hasLoadedRecipesRef.current = true;
        setHasLoadedRecipes(true);
      }
    }
  }, [activeCompanyId]);

  const loadJobs = useCallback(async (options?: { showLoadingState?: boolean }) => {
    const showLoadingState = options?.showLoadingState ?? !hasLoadedJobsRef.current;
    if (!activeCompanyId) {
      setRunningJobs([]);
      setCompletedJobs([]);
      if (showLoadingState) {
        setIsLoadingJobs(false);
      }
      if (!hasLoadedJobsRef.current) {
        hasLoadedJobsRef.current = true;
        setHasLoadedJobs(true);
      }
      return;
    }

    if (showLoadingState) {
      setIsLoadingJobs(true);
    }
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
      if (showLoadingState) {
        setIsLoadingJobs(false);
      }
      if (!hasLoadedJobsRef.current) {
        hasLoadedJobsRef.current = true;
        setHasLoadedJobs(true);
      }
    }
  }, [activeCompanyId]);

  const loadSpecializations = useCallback(async () => {
    setIsLoadingSpecializations(true);
    try {
      const rows = await listCompanySpecializations();
      setSpecializationOptions(rows);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load company focus options");
    } finally {
      setIsLoadingSpecializations(false);
    }
  }, []);

  const loadProductionState = useCallback(async () => {
    try {
      await Promise.all([
        loadRecipes({ showLoadingState: true }),
        loadJobs({ showLoadingState: true }),
        loadSpecializations()
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load production state");
    }
  }, [loadJobs, loadRecipes, loadSpecializations]);

  useEffect(() => {
    void loadProductionState();
  }, [loadProductionState]);

  useEffect(() => {
    const tick = health?.currentTick;
    if (
      tick === undefined ||
      nextRunningCompletionTick === null ||
      tick < nextRunningCompletionTick
    ) {
      return;
    }

    const timeout = setTimeout(() => {
      void loadJobs({ showLoadingState: false });
    }, PRODUCTION_REFRESH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [health?.currentTick, loadJobs, nextRunningCompletionTick]);

  useEffect(() => {
    completedJobIdsRef.current = new Set();
    didPrimeCompletedRef.current = false;
  }, [activeCompanyId]);

  useEffect(() => {
    const nextIds = new Set(completedJobs.map((job) => job.id));
    if (!didPrimeCompletedRef.current) {
      completedJobIdsRef.current = nextIds;
      didPrimeCompletedRef.current = true;
      return;
    }

    let hasNewCompletion = false;
    for (const jobId of nextIds) {
      if (!completedJobIdsRef.current.has(jobId)) {
        hasNewCompletion = true;
        break;
      }
    }
    if (hasNewCompletion) {
      play("event_production_completed");
    }
    completedJobIdsRef.current = nextIds;
  }, [completedJobs, play]);
  const showInitialRecipesSkeleton = isLoadingRecipes && !hasLoadedRecipes;
  const showInitialJobsSkeleton = isLoadingJobs && !hasLoadedJobs;

  const handleSpecializationChange = async (nextSpecialization: string) => {
    if (!activeCompanyId) {
      setError(UI_COPY.common.selectCompanyFirst);
      return;
    }

    const specialization = nextSpecialization as CompanySpecialization;
    if (specialization === activeCompany?.specialization) {
      return;
    }

    setIsUpdatingSpecialization(true);
    try {
      await setCompanySpecialization(activeCompanyId, specialization);
      await Promise.all([
        refreshCompanies(),
        loadRecipes({ showLoadingState: false })
      ]);
      showToast({
        title: "Company focus updated",
        description: "Unlocked item lanes were refreshed for this company.",
        variant: "success"
      });
      play("feedback_success");
      setError(null);
    } catch (caught) {
      const message = mapProductionErrorMessage(caught);
      setError(message);
      showToast({
        title: "Focus update failed",
        description: message,
        variant: "error"
      });
    } finally {
      setIsUpdatingSpecialization(false);
    }
  };

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
      play("action_start_production");
      setError(null);
      showToast({
        title: "Production started",
        description: `Started ${quantity} run(s).`,
        variant: "success",
        sound: "none"
      });
      await loadJobs({ showLoadingState: false });
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
          variant: "success",
          sound: "none"
        });
      } else {
        showToast({
          title: "Job already finalized",
          description: `Status is ${formatCodeLabel(job.status)}.`,
          variant: "info"
        });
      }
      await loadJobs({ showLoadingState: false });
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
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Company Focus</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Pick one focus for this company. It decides which products this company can make and sell.
              </p>
              <Popover open={isFocusPickerOpen} onOpenChange={setIsFocusPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={isFocusPickerOpen}
                    className="w-full justify-between"
                    disabled={!activeCompanyId || isUpdatingSpecialization || isLoadingSpecializations}
                  >
                    <span className="truncate">
                      {activeSpecializationOption ? activeSpecializationOption.label : "Select company focus"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandList>
                      <CommandEmpty>No focus options found.</CommandEmpty>
                      <CommandGroup>
                        {specializationOptions.map((option) => (
                          <CommandItem
                            key={option.code}
                            value={`${option.label} ${option.code}`}
                            onSelect={() => {
                              setIsFocusPickerOpen(false);
                              if (option.code !== activeCompany?.specialization) {
                                void handleSpecializationChange(option.code);
                              }
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                option.code === activeCompany?.specialization ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span className="truncate">{option.label}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {activeSpecializationOption ? (
                <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">{activeSpecializationOption.label}</p>
                  <p>{activeSpecializationOption.description}</p>
                  <p className="mt-2">Example item codes:</p>
                  <p className="font-mono text-[11px] text-foreground">
                    {activeSpecializationOption.sampleItemCodes.join(", ")}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

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
                  <Input
                    value={recipeSearch}
                    onChange={(event) => setRecipeSearch(event.target.value)}
                    placeholder="Search recipe by code, name, output, or input"
                    className="mb-2"
                  />
                  <Select value={selectedRecipeId} onValueChange={setSelectedRecipeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select recipe" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectRecipeRows.map((row) => (
                        <SelectItem key={row.recipe.id} value={row.recipe.id}>
                          {row.recipe.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {filteredRecipeRows.length > selectRecipeRows.length ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Showing first {selectRecipeRows.length} matching recipes in dropdown.
                    </p>
                  ) : null}
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
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recipes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <p>
                Showing {recipeRangeLabel} of {filteredRecipeRows.length} filtered recipes ({recipes.length} total)
              </p>
              <DeferredSearchStatus isUpdating={deferredRecipeSearch !== recipeSearch} />
              <div className="flex items-center gap-2">
                <Select
                  value={String(recipePageSize)}
                  onValueChange={(value) =>
                    setRecipePageSize(
                      Number.parseInt(value, 10) as (typeof PRODUCTION_RECIPE_PAGE_SIZE_OPTIONS)[number]
                    )
                  }
                >
                  <SelectTrigger className="h-8 w-28">
                    <SelectValue placeholder="Page size" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCTION_RECIPE_PAGE_SIZE_OPTIONS.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size} / page
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                {showInitialRecipesSkeleton && pagedRecipeRows.length === 0 ? <TableSkeletonRows columns={4} /> : null}
                {pagedRecipeRows.map((row) => (
                  <TableRow key={row.recipe.id}>
                    <TableCell>
                      <p className="font-medium">{row.recipe.name}</p>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1">
                        <span>{row.recipe.outputQuantity}</span>
                        <ItemLabel
                          itemCode={row.recipe.outputItem.code}
                          itemName={row.recipe.outputItem.name}
                        />
                      </span>
                    </TableCell>
                    <TableCell>{formatCadenceCount(row.recipe.durationTicks)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {row.recipe.inputs.map((input) => (
                          <span key={input.itemId} className="inline-flex items-center gap-1">
                            <span>{input.quantityPerRun}</span>
                            <ItemLabel itemCode={input.item.code} itemName={input.item.name} />
                          </span>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!showInitialRecipesSkeleton && pagedRecipeRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No recipes available for current filters.
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
              {showInitialJobsSkeleton && runningJobs.length === 0 ? <TableSkeletonRows columns={6} /> : null}
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
              {!showInitialJobsSkeleton && runningJobs.length === 0 ? (
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
              {showInitialJobsSkeleton && completedJobs.length === 0 ? <TableSkeletonRows columns={5} /> : null}
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
              {!showInitialJobsSkeleton && completedJobs.length === 0 ? (
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


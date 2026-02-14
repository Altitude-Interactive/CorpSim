"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useActiveCompany } from "@/components/company/active-company-provider";
import { useWorldHealth } from "@/components/layout/world-health-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  ApiClientError,
  ResearchNode,
  cancelResearchNode,
  listResearch,
  startResearchNode
} from "@/lib/api";
import { UI_COPY } from "@/lib/ui-copy";
import { ResearchNodeDetails } from "./research-node-details";
import { ResearchNodeList, ResearchTierGroup } from "./research-node-list";

const RESEARCH_REFRESH_DEBOUNCE_MS = 500;
const RESEARCH_NODE_PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

function mapApiError(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === 400) {
      return error.message;
    }
    if (error.status === 403) {
      return UI_COPY.common.unavailableForCompany;
    }
    if (error.status === 404) {
      return UI_COPY.common.recordNotFound;
    }
    if (error.status === 409) {
      return UI_COPY.common.dataChangedRetry;
    }
    return error.message;
  }

  return error instanceof Error ? error.message : "Unexpected research error";
}

function computeResearchTierGroups(nodes: ResearchNode[]): ResearchTierGroup[] {
  const byId = new Map(nodes.map((node) => [node.id, node] as const));
  const cache = new Map<string, number>();
  const visiting = new Set<string>();

  const resolveTier = (nodeId: string): number => {
    const cached = cache.get(nodeId);
    if (cached !== undefined) {
      return cached;
    }

    if (visiting.has(nodeId)) {
      return 0;
    }
    visiting.add(nodeId);

    const node = byId.get(nodeId);
    if (!node || node.prerequisites.length === 0) {
      cache.set(nodeId, 0);
      visiting.delete(nodeId);
      return 0;
    }

    const tier =
      Math.max(...node.prerequisites.map((entry) => resolveTier(entry.nodeId))) + 1;
    cache.set(nodeId, tier);
    visiting.delete(nodeId);
    return tier;
  };

  const grouped = new Map<number, ResearchNode[]>();
  for (const node of nodes) {
    const tier = resolveTier(node.id);
    const rows = grouped.get(tier) ?? [];
    rows.push(node);
    grouped.set(tier, rows);
  }

  return Array.from(grouped.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([tier, tierNodes]) => ({
      tier,
      nodes: [...tierNodes].sort((a, b) => a.name.localeCompare(b.name))
    }));
}

export function ResearchPage() {
  const { showToast } = useToast();
  const { health } = useWorldHealth();
  const { activeCompany, activeCompanyId } = useActiveCompany();

  const [nodes, setNodes] = useState<ResearchNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nodeSearch, setNodeSearch] = useState("");
  const [nodeStatusFilter, setNodeStatusFilter] =
    useState<"ALL" | ResearchNode["status"]>("ALL");
  const [nodePage, setNodePage] = useState(1);
  const [nodePageSize, setNodePageSize] =
    useState<(typeof RESEARCH_NODE_PAGE_SIZE_OPTIONS)[number]>(50);
  const deferredNodeSearch = useDeferredValue(nodeSearch);

  const loadResearch = useCallback(async (options?: { force?: boolean }) => {
    if (!activeCompanyId) {
      setNodes([]);
      setSelectedNodeId(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const rows = await listResearch(activeCompanyId, { force: options?.force });
      setNodes(rows);
      setError(null);
      setSelectedNodeId((current) => {
        if (current && rows.some((node) => node.id === current)) {
          return current;
        }
        return rows[0]?.id ?? null;
      });
    } catch (caught) {
      setError(mapApiError(caught));
    } finally {
      setIsLoading(false);
    }
  }, [activeCompanyId]);

  useEffect(() => {
    void loadResearch();
  }, [loadResearch]);

  const nextResearchCompletionTick = useMemo(() => {
    const researching = nodes.filter(
      (node) => node.status === "RESEARCHING" && node.tickCompletes !== null
    );

    if (researching.length === 0) {
      return null;
    }

    return researching.reduce<number>(
      (minTick, node) => Math.min(minTick, node.tickCompletes ?? Number.MAX_SAFE_INTEGER),
      Number.MAX_SAFE_INTEGER
    );
  }, [nodes]);

  useEffect(() => {
    if (
      !activeCompanyId ||
      health?.currentTick === undefined ||
      nextResearchCompletionTick === null ||
      health.currentTick < nextResearchCompletionTick
    ) {
      return;
    }

    const timeout = setTimeout(() => {
      void loadResearch({ force: true });
    }, RESEARCH_REFRESH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [activeCompanyId, health?.currentTick, loadResearch, nextResearchCompletionTick]);

  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node] as const)), [nodes]);
  const selectedNode = selectedNodeId ? nodeById.get(selectedNodeId) ?? null : null;

  const filteredNodes = useMemo(() => {
    const needle = deferredNodeSearch.trim().toLowerCase();

    return nodes.filter((node) => {
      if (nodeStatusFilter !== "ALL" && node.status !== nodeStatusFilter) {
        return false;
      }

      if (!needle) {
        return true;
      }

      return `${node.code} ${node.name} ${node.description}`.toLowerCase().includes(needle);
    });
  }, [deferredNodeSearch, nodeStatusFilter, nodes]);

  useEffect(() => {
    setNodePage(1);
  }, [nodeSearch, nodeStatusFilter, nodePageSize]);

  const totalNodePages = useMemo(
    () => Math.max(1, Math.ceil(filteredNodes.length / nodePageSize)),
    [filteredNodes.length, nodePageSize]
  );

  useEffect(() => {
    if (nodePage > totalNodePages) {
      setNodePage(totalNodePages);
    }
  }, [nodePage, totalNodePages]);

  const pagedNodes = useMemo(() => {
    const start = (nodePage - 1) * nodePageSize;
    return filteredNodes.slice(start, start + nodePageSize);
  }, [filteredNodes, nodePage, nodePageSize]);

  const nodeRangeLabel = useMemo(() => {
    if (filteredNodes.length === 0) {
      return "0-0";
    }

    const start = (nodePage - 1) * nodePageSize + 1;
    const end = Math.min(nodePage * nodePageSize, filteredNodes.length);
    return `${start}-${end}`;
  }, [filteredNodes.length, nodePage, nodePageSize]);

  const groups = useMemo(() => computeResearchTierGroups(pagedNodes), [pagedNodes]);
  const statusCounts = useMemo(() => {
    return nodes.reduce(
      (acc, node) => {
        if (node.status === "LOCKED") {
          acc.locked += 1;
        } else if (node.status === "AVAILABLE") {
          acc.available += 1;
        } else if (node.status === "RESEARCHING") {
          acc.researching += 1;
        } else if (node.status === "COMPLETED") {
          acc.completed += 1;
        }
        return acc;
      },
      {
        locked: 0,
        available: 0,
        researching: 0,
        completed: 0
      }
    );
  }, [nodes]);

  const startSelectedResearch = async (node: ResearchNode) => {
    if (!activeCompanyId) {
      showToast({
        title: "Company required",
        description: UI_COPY.common.selectCompanyFirst,
        variant: "error"
      });
      return;
    }

    setIsMutating(true);
    try {
      await startResearchNode(node.id, activeCompanyId);
      showToast({
        title: "Research started",
        description: `${node.name} is now in progress.`,
        variant: "success"
      });
      await loadResearch({ force: true });
    } catch (caught) {
      const message = mapApiError(caught);
      setError(message);
      showToast({
        title: "Start failed",
        description: message,
        variant: "error"
      });
    } finally {
      setIsMutating(false);
    }
  };

  const cancelSelectedResearch = async (node: ResearchNode) => {
    if (!activeCompanyId) {
      showToast({
        title: "Company required",
        description: UI_COPY.common.selectCompanyFirst,
        variant: "error"
      });
      return;
    }

    setIsMutating(true);
    try {
      await cancelResearchNode(node.id, activeCompanyId);
      showToast({
        title: "Research cancelled",
        description: `${node.name} was cancelled without refund.`,
        variant: "info"
      });
      await loadResearch({ force: true });
    } catch (caught) {
      const message = mapApiError(caught);
      setError(message);
      showToast({
        title: "Cancel failed",
        description: message,
        variant: "error"
      });
    } finally {
      setIsMutating(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Research Program</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Active company:{" "}
            {activeCompany ? activeCompany.name : UI_COPY.common.noCompanySelected}
          </p>
          <div className="grid gap-2 md:grid-cols-4">
            <p className="text-sm text-muted-foreground">
              Locked: <span className="tabular-nums text-foreground">{statusCounts.locked}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Available:{" "}
              <span className="tabular-nums text-foreground">{statusCounts.available}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Researching:{" "}
              <span className="tabular-nums text-foreground">{statusCounts.researching}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Completed:{" "}
              <span className="tabular-nums text-foreground">{statusCounts.completed}</span>
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void loadResearch({ force: true });
            }}
            disabled={isLoading || isMutating}
          >
            Refresh Research
          </Button>
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Research Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={nodeSearch}
              onChange={(event) => setNodeSearch(event.target.value)}
              placeholder="Search by code, name, or description"
              className="w-full md:w-80"
            />
            <Select
              value={nodeStatusFilter}
              onValueChange={(value) => setNodeStatusFilter(value as "ALL" | ResearchNode["status"])}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="LOCKED">Locked</SelectItem>
                <SelectItem value="AVAILABLE">Available</SelectItem>
                <SelectItem value="RESEARCHING">Researching</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={String(nodePageSize)}
              onValueChange={(value) =>
                setNodePageSize(
                  Number.parseInt(value, 10) as (typeof RESEARCH_NODE_PAGE_SIZE_OPTIONS)[number]
                )
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Page size" />
              </SelectTrigger>
              <SelectContent>
                {RESEARCH_NODE_PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size} / page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <p>
              Showing {nodeRangeLabel} of {filteredNodes.length} filtered initiatives ({nodes.length} total)
            </p>
            {deferredNodeSearch !== nodeSearch ? <p>Updating results...</p> : null}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setNodePage((page) => Math.max(1, page - 1))}
                disabled={nodePage <= 1}
              >
                Previous
              </Button>
              <span className="tabular-nums">
                Page {nodePage} / {totalNodePages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setNodePage((page) => Math.min(totalNodePages, page + 1))}
                disabled={nodePage >= totalNodePages}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <ResearchNodeList
          groups={groups}
          selectedNodeId={selectedNodeId}
          currentTick={health?.currentTick}
          isLoading={isLoading}
          onSelect={setSelectedNodeId}
        />
        <ResearchNodeDetails
          node={selectedNode}
          currentTick={health?.currentTick}
          nodeById={nodeById}
          isMutating={isMutating}
          onStart={startSelectedResearch}
          onCancel={cancelSelectedResearch}
        />
      </div>
    </div>
  );
}

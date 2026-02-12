"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useActiveCompany } from "@/components/company/active-company-provider";
import { useWorldHealth } from "@/components/layout/world-health-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import {
  ApiClientError,
  ResearchNode,
  cancelResearchNode,
  listResearch,
  startResearchNode
} from "@/lib/api";
import { ResearchNodeDetails } from "./research-node-details";
import { ResearchNodeList, ResearchTierGroup } from "./research-node-list";

const RESEARCH_REFRESH_DEBOUNCE_MS = 500;

function mapApiError(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === 400) {
      return error.message;
    }
    if (error.status === 403) {
      return "forbidden for active company";
    }
    if (error.status === 404) {
      return "company or research node not found";
    }
    if (error.status === 409) {
      return "conflict detected, refresh and retry";
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
      nodes: [...tierNodes].sort((a, b) => a.code.localeCompare(b.code))
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

  const loadResearch = useCallback(async () => {
    if (!activeCompanyId) {
      setNodes([]);
      setSelectedNodeId(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const rows = await listResearch(activeCompanyId);
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

  useEffect(() => {
    if (!activeCompanyId || health?.currentTick === undefined) {
      return;
    }

    const timeout = setTimeout(() => {
      void loadResearch();
    }, RESEARCH_REFRESH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [activeCompanyId, health?.currentTick, loadResearch]);

  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node] as const)), [nodes]);
  const selectedNode = selectedNodeId ? nodeById.get(selectedNodeId) ?? null : null;
  const groups = useMemo(() => computeResearchTierGroups(nodes), [nodes]);
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
        title: "No active company",
        description: "Select an active company before starting research.",
        variant: "error"
      });
      return;
    }

    setIsMutating(true);
    try {
      await startResearchNode(node.id, activeCompanyId);
      showToast({
        title: "Research started",
        description: `${node.code} is now running.`,
        variant: "success"
      });
      await loadResearch();
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
        title: "No active company",
        description: "Select an active company before cancelling research.",
        variant: "error"
      });
      return;
    }

    setIsMutating(true);
    try {
      await cancelResearchNode(node.id, activeCompanyId);
      showToast({
        title: "Research cancelled",
        description: `${node.code} was cancelled without refund.`,
        variant: "info"
      });
      await loadResearch();
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
            {activeCompany ? `${activeCompany.code} - ${activeCompany.name}` : "No company selected"}
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
              void loadResearch();
            }}
            disabled={isLoading || isMutating}
          >
            Refresh Research
          </Button>
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
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

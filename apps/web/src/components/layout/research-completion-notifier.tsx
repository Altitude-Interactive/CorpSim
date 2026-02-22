"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useActiveCompany } from "@/components/company/active-company-provider";
import { useUiSfx } from "@/components/layout/ui-sfx-provider";
import { useWorldHealth } from "@/components/layout/world-health-provider";
import { useToast } from "@/components/ui/toast-manager";
import { ResearchNode, listResearch } from "@/lib/api";

const RESEARCH_REFRESH_DEBOUNCE_MS = 500;
const MAX_RECIPES_IN_TOAST = 3;

function buildResearchCompletionMessage(completedNodes: ResearchNode[]): string {
  const unlockedRecipes = completedNodes.flatMap((node) => node.unlockRecipes);
  const uniqueRecipeNames = Array.from(
    new Set(
      unlockedRecipes
        .map((recipe) => recipe.recipeName)
        .filter((name): name is string => Boolean(name && name.trim()))
    )
  );

  if (uniqueRecipeNames.length === 0) {
    return "Research complete!";
  }

  const displayedNames = uniqueRecipeNames.slice(0, MAX_RECIPES_IN_TOAST);
  const remainingCount = uniqueRecipeNames.length - displayedNames.length;
  const baseList = displayedNames.join(", ");
  const summary = remainingCount > 0 ? `${baseList} + ${remainingCount} more` : baseList;
  return `Research complete! Unlocked recipes: ${summary}`;
}

export function ResearchCompletionNotifier() {
  const { activeCompanyId } = useActiveCompany();
  const { health } = useWorldHealth();
  const { play } = useUiSfx();
  const { showToast } = useToast();

  const [nodes, setNodes] = useState<ResearchNode[]>([]);
  const statusByNodeIdRef = useRef<Map<string, ResearchNode["status"]>>(new Map());
  const didPrimeStatusesRef = useRef(false);

  const loadResearch = useCallback(
    async (options?: { force?: boolean }) => {
      if (!activeCompanyId) {
        setNodes([]);
        return;
      }

      try {
        const rows = await listResearch(activeCompanyId, { force: options?.force });
        setNodes(rows);
      } catch {
        // Ignore background notifier fetch failures and retry on next tick.
      }
    },
    [activeCompanyId]
  );

  useEffect(() => {
    statusByNodeIdRef.current = new Map();
    didPrimeStatusesRef.current = false;

    if (!activeCompanyId) {
      setNodes([]);
      return;
    }

    void loadResearch({ force: true });
  }, [activeCompanyId, loadResearch]);

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

  useEffect(() => {
    const nextStatusById = new Map(nodes.map((node) => [node.id, node.status] as const));
    if (!didPrimeStatusesRef.current) {
      statusByNodeIdRef.current = nextStatusById;
      didPrimeStatusesRef.current = true;
      return;
    }

    const completedNodes: ResearchNode[] = [];
    for (const [nodeId, nextStatus] of nextStatusById.entries()) {
      const previousStatus = statusByNodeIdRef.current.get(nodeId);
      if (previousStatus !== "COMPLETED" && nextStatus === "COMPLETED") {
        const node = nodeById.get(nodeId);
        if (node) {
          completedNodes.push(node);
        }
      }
    }

    if (completedNodes.length > 0) {
      play("event_research_completed");
      showToast({
        title: completedNodes.length === 1 ? completedNodes[0].name : "Research Complete",
        description: buildResearchCompletionMessage(completedNodes),
        variant: "success",
        sound: "none"
      });
    }

    statusByNodeIdRef.current = nextStatusById;
  }, [nodeById, nodes, play, showToast]);

  return null;
}

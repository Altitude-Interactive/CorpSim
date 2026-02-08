"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ResearchNode } from "@/lib/api";
import { formatCents } from "@/lib/format";

function mapStatusVariant(status: ResearchNode["status"]): "muted" | "info" | "warning" | "success" {
  switch (status) {
    case "AVAILABLE":
      return "info";
    case "RESEARCHING":
      return "warning";
    case "COMPLETED":
      return "success";
    case "LOCKED":
    default:
      return "muted";
  }
}

function formatTickCountdown(targetTick: number | null, currentTick: number | undefined): string {
  if (targetTick === null || currentTick === undefined) {
    return "-";
  }

  const remaining = Math.max(0, targetTick - currentTick);
  return `${remaining} tick(s)`;
}

interface ResearchNodeDetailsProps {
  node: ResearchNode | null;
  currentTick: number | undefined;
  nodeById: Map<string, ResearchNode>;
  isMutating: boolean;
  onStart: (node: ResearchNode) => Promise<void>;
  onCancel: (node: ResearchNode) => Promise<void>;
}

export function ResearchNodeDetails({
  node,
  currentTick,
  nodeById,
  isMutating,
  onStart,
  onCancel
}: ResearchNodeDetailsProps) {
  if (!node) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Research Details</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Select a research node to inspect details.</p>
        </CardContent>
      </Card>
    );
  }

  const canStart = node.status === "AVAILABLE";
  const canCancel = node.status === "RESEARCHING";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>{node.name}</span>
          <Badge variant={mapStatusVariant(node.status)}>{node.status}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{node.code}</p>
          <p className="text-sm text-muted-foreground">{node.description}</p>
        </div>
        <Separator />
        <div className="grid grid-cols-2 gap-2 text-sm">
          <p className="text-muted-foreground">Cost</p>
          <p className="tabular-nums">{formatCents(node.costCashCents)}</p>
          <p className="text-muted-foreground">Duration</p>
          <p className="tabular-nums">{node.durationTicks} tick(s)</p>
          <p className="text-muted-foreground">Tick Started</p>
          <p className="tabular-nums">{node.tickStarted ?? "-"}</p>
          <p className="text-muted-foreground">Tick Completes</p>
          <p className="tabular-nums">{node.tickCompletes ?? "-"}</p>
          <p className="text-muted-foreground">Countdown</p>
          <p className="tabular-nums">{formatTickCountdown(node.tickCompletes, currentTick)}</p>
        </div>
        <Separator />
        <div className="space-y-2">
          <p className="text-sm font-medium">Prerequisites</p>
          {node.prerequisites.length === 0 ? (
            <p className="text-sm text-muted-foreground">None</p>
          ) : (
            <div className="space-y-1">
              {node.prerequisites.map((entry) => {
                const prereqNode = nodeById.get(entry.nodeId);
                const label = prereqNode ? `${prereqNode.code} - ${prereqNode.name}` : entry.nodeId;
                const completed = prereqNode?.status === "COMPLETED";
                return (
                  <div key={entry.nodeId} className="flex items-center justify-between gap-2">
                    <p className="text-sm">{label}</p>
                    <Badge variant={completed ? "success" : "muted"}>
                      {completed ? "Completed" : "Pending"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <Separator />
        <div className="space-y-2">
          <p className="text-sm font-medium">Unlocks Recipes</p>
          {node.unlockRecipes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recipe unlocks.</p>
          ) : (
            <ul className="space-y-1">
              {node.unlockRecipes.map((recipe) => (
                <li key={recipe.recipeId} className="text-sm">
                  <span className="font-mono text-xs text-muted-foreground">{recipe.recipeCode}</span>
                  {" - "}
                  {recipe.recipeName}
                </li>
              ))}
            </ul>
          )}
        </div>
        <Separator />
        <div className="flex gap-2">
          <Button
            disabled={!canStart || isMutating}
            onClick={() => {
              void onStart(node);
            }}
          >
            Start Research
          </Button>
          <Button
            variant="outline"
            disabled={!canCancel || isMutating}
            onClick={() => {
              void onCancel(node);
            }}
          >
            Cancel Research
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

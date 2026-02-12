"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCents } from "@/lib/format";
import { ResearchNode } from "@/lib/api";
import { formatCadenceCount } from "@/lib/ui-terms";
import { formatCodeLabel } from "@/lib/ui-copy";

export interface ResearchTierGroup {
  tier: number;
  nodes: ResearchNode[];
}

function formatCompletesIn(node: ResearchNode, currentTick: number | undefined): string {
  if (node.status !== "RESEARCHING" || node.tickCompletes === null || currentTick === undefined) {
    return "-";
  }

  const remaining = Math.max(0, node.tickCompletes - currentTick);
  return formatCadenceCount(remaining);
}

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

interface ResearchNodeListProps {
  groups: ResearchTierGroup[];
  selectedNodeId: string | null;
  currentTick: number | undefined;
  isLoading: boolean;
  onSelect: (nodeId: string) => void;
}

export function ResearchNodeList({
  groups,
  selectedNodeId,
  currentTick,
  isLoading,
  onSelect
}: ResearchNodeListProps) {
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <Card key={group.tier}>
          <CardHeader>
            <CardTitle>Tier {group.tier + 1}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Initiative</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Completes In</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.nodes.map((node) => {
                  const isSelected = selectedNodeId === node.id;
                  return (
                    <TableRow key={node.id} className={isSelected ? "bg-primary/10" : undefined}>
                      <TableCell>
                        <button
                          type="button"
                          className="text-left"
                          onClick={() => onSelect(node.id)}
                        >
                          <p className="font-medium">{node.name}</p>
                        </button>
                      </TableCell>
                      <TableCell>
                        <Badge variant={mapStatusVariant(node.status)}>{formatCodeLabel(node.status)}</Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">{formatCents(node.costCashCents)}</TableCell>
                      <TableCell className="tabular-nums">{formatCadenceCount(node.durationTicks)}</TableCell>
                      <TableCell className="tabular-nums">
                        {formatCompletesIn(node, currentTick)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!isLoading && group.nodes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No research nodes in this tier.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

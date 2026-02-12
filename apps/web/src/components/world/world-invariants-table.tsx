"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WorldHealth } from "@/lib/api";

interface WorldInvariantsTableProps {
  invariants: WorldHealth["invariants"] | null;
  isLoading: boolean;
}

function resolveStatusBadge(
  invariants: WorldHealth["invariants"] | null
): { label: string; variant: "success" | "danger" | "muted" } {
  if (!invariants) {
    return {
      label: "Unknown",
      variant: "muted"
    };
  }

  if (invariants.hasViolations) {
    return {
      label: "Violations",
      variant: "danger"
    };
  }

  return {
    label: "Healthy",
    variant: "success"
  };
}

function SampleIdsCell({ companyId, itemId }: { companyId: string; itemId?: string }) {
  return (
    <div className="space-y-1 font-mono text-xs text-muted-foreground">
      <p>company: {companyId}</p>
      {itemId ? <p>item: {itemId}</p> : null}
    </div>
  );
}

function InvariantTableSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <TableRow key={`invariant-skeleton-${index}`}>
          <TableCell>
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          </TableCell>
          <TableCell>
            <div className="h-3 w-16 animate-pulse rounded bg-muted" />
          </TableCell>
          <TableCell>
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
          </TableCell>
          <TableCell>
            <div className="h-3 w-36 animate-pulse rounded bg-muted" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function WorldInvariantsTable({ invariants, isLoading }: WorldInvariantsTableProps) {
  const status = resolveStatusBadge(invariants);
  const issues = invariants?.issues ?? [];
  const issueCount = issues.length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Invariants</CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant={status.variant}>{status.label}</Badge>
          {invariants ? (
            <Badge variant={invariants.truncated ? "warning" : "muted"}>
              {invariants.truncated ? "Truncated" : "Complete"}
            </Badge>
          ) : null}
          <Badge variant="muted">{issueCount.toLocaleString()} issue(s)</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Sample IDs</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && !invariants ? <InvariantTableSkeleton /> : null}
            {invariants &&
              invariants.issues.map((issue, index) => (
              <TableRow key={`${issue.code}-${issue.companyId}-${index}`}>
                <TableCell className="font-mono text-xs">{issue.code}</TableCell>
                <TableCell className="text-xs uppercase">{issue.entityType}</TableCell>
                <TableCell className="text-sm">{issue.message}</TableCell>
                <TableCell>
                  <SampleIdsCell companyId={issue.companyId} itemId={issue.itemId} />
                </TableCell>
              </TableRow>
            ))}
            {invariants && invariants.issues.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No invariant issues detected.
                </TableCell>
              </TableRow>
            ) : null}
            {!isLoading && !invariants ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Invariant status unavailable.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

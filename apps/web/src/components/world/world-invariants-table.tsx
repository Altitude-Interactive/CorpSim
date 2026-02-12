"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WorldHealth } from "@/lib/api";
import { UI_COPY } from "@/lib/ui-copy";

interface WorldInvariantsTableProps {
  invariants: WorldHealth["invariants"] | null;
  isLoading: boolean;
  showTechnicalDetails: boolean;
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
      label: UI_COPY.world.integrity.violations,
      variant: "danger"
    };
  }

  return {
    label: UI_COPY.world.integrity.healthy,
    variant: "success"
  };
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
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
          </TableCell>
          <TableCell>
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

function mapScope(entityType: WorldHealth["invariants"]["issues"][number]["entityType"]): string {
  if (entityType === "inventory") {
    return "Inventory";
  }

  return "Company";
}

function mapSuggestedAction(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("cash")) {
    return "Review finance balances and open commitments.";
  }

  if (normalized.includes("inventory")) {
    return "Review stock levels and pending transfers.";
  }

  return "Review the related operational records and retry refresh.";
}

function TechnicalDetails({ invariants }: { invariants: WorldHealth["invariants"] }) {
  if (invariants.issues.length === 0) {
    return null;
  }

  return (
    <details className="mt-3 rounded-md border border-border bg-muted/20 p-3 text-xs">
      <summary className="cursor-pointer font-medium text-muted-foreground">
        Diagnostic details
      </summary>
      <div className="mt-3 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Check</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Affected records</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invariants.issues.map((issue, index) => (
              <TableRow key={`${issue.code}-${issue.companyId}-${index}`}>
                <TableCell>Integrity rule</TableCell>
                <TableCell>{mapScope(issue.entityType)}</TableCell>
                <TableCell>{issue.message}</TableCell>
                <TableCell>{issue.itemId ? "Company and item records" : "Company record"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </details>
  );
}

export function WorldInvariantsTable({
  invariants,
  isLoading,
  showTechnicalDetails
}: WorldInvariantsTableProps) {
  const status = resolveStatusBadge(invariants);
  const issues = invariants?.issues ?? [];
  const issueCount = issues.length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>{UI_COPY.world.integrity.title}</CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant={status.variant}>{status.label}</Badge>
          {invariants ? (
            <Badge variant={invariants.truncated ? "warning" : "muted"}>
              {invariants.truncated ? UI_COPY.world.integrity.partial : UI_COPY.world.integrity.complete}
            </Badge>
          ) : null}
          <Badge variant="muted">{`${issueCount.toLocaleString()} ${issueCount === 1 ? "issue" : "issues"}`}</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Scope</TableHead>
              <TableHead>Issue</TableHead>
              <TableHead>Suggested action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && !invariants ? <InvariantTableSkeleton /> : null}
            {issues.map((issue, index) => (
              <TableRow key={`${issue.code}-${issue.companyId}-${index}`}>
                <TableCell>{mapScope(issue.entityType)}</TableCell>
                <TableCell>{issue.message}</TableCell>
                <TableCell>{mapSuggestedAction(issue.message)}</TableCell>
              </TableRow>
            ))}
            {invariants && issues.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  {UI_COPY.world.integrity.healthy}
                </TableCell>
              </TableRow>
            ) : null}
            {!isLoading && !invariants ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  {UI_COPY.world.integrity.unavailable}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
        {showTechnicalDetails && invariants ? <TechnicalDetails invariants={invariants} /> : null}
      </CardContent>
    </Card>
  );
}

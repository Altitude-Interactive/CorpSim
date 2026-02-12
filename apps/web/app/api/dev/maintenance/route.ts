import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { NextResponse } from "next/server";

const DEFAULT_MAINTENANCE_REASON = "Systems are currently being updated.";

function findRepoRoot(startDir: string): string {
  let current = resolve(startDir);

  for (;;) {
    const hasWorkspace = existsSync(resolve(current, "pnpm-workspace.yaml"));
    const hasGitDirectory = existsSync(resolve(current, ".git"));
    if (hasWorkspace || hasGitDirectory) {
      return current;
    }

    const parent = resolve(current, "..");
    if (parent === current) {
      return startDir;
    }
    current = parent;
  }
}

function buildDefaultMaintenanceState() {
  return {
    enabled: false,
    updatedAt: new Date().toISOString(),
    reason: DEFAULT_MAINTENANCE_REASON,
    scope: "all" as const
  };
}

function sanitizeScope(value: unknown): "all" | "web-only" {
  return value === "web-only" ? "web-only" : "all";
}

function sanitizeReason(value: unknown): string {
  if (typeof value !== "string") {
    return DEFAULT_MAINTENANCE_REASON;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_MAINTENANCE_REASON;
}

function sanitizeEnabledBy(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function sanitizeUpdatedAt(value: unknown): string {
  if (typeof value !== "string") {
    return new Date().toISOString();
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return new Date().toISOString();
  }

  return new Date(parsed).toISOString();
}

function sanitizeMaintenancePayload(payload: unknown) {
  const fallback = buildDefaultMaintenanceState();

  if (typeof payload !== "object" || payload === null) {
    return fallback;
  }

  const row = payload as Record<string, unknown>;
  return {
    enabled: row.enabled === true,
    updatedAt: sanitizeUpdatedAt(row.updatedAt),
    reason: sanitizeReason(row.reason),
    enabledBy: sanitizeEnabledBy(row.enabledBy),
    scope: sanitizeScope(row.scope)
  };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const maintenanceFile = resolve(findRepoRoot(process.cwd()), ".corpsim", "maintenance.json");

  try {
    const raw = await readFile(maintenanceFile, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return NextResponse.json(sanitizeMaintenancePayload(parsed), {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return NextResponse.json(buildDefaultMaintenanceState(), {
        headers: {
          "Cache-Control": "no-store"
        }
      });
    }

    return NextResponse.json(buildDefaultMaintenanceState(), {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  }
}

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  DEFAULT_MAINTENANCE_REASON,
  MaintenanceScope,
  MaintenanceState,
  MaintenanceStateUpdate
} from "./maintenance.types";

interface MaintenanceRow {
  enabled: boolean;
  updatedAt: Date;
  reason: string;
  enabledBy: string | null;
  scope: string;
}

interface ErrorWithCode {
  code?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeScope(value: unknown, fallback: MaintenanceScope = "all"): MaintenanceScope {
  if (value === "all" || value === "web-only") {
    return value;
  }

  return fallback;
}

function normalizeUpdatedAt(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return new Date(parsed).toISOString();
}

function normalizeReason(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return fallback;
  }

  return trimmed;
}

function normalizeEnabledBy(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function buildDefaultMaintenanceState(now = new Date()): MaintenanceState {
  return {
    enabled: false,
    updatedAt: now.toISOString(),
    reason: DEFAULT_MAINTENANCE_REASON,
    scope: "all"
  };
}

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

@Injectable()
export class MaintenanceService {
  private readonly prisma: PrismaService;
  private readonly maintenanceFilePath = resolve(
    findRepoRoot(process.cwd()),
    ".corpsim",
    "maintenance.json"
  );
  private hasLoggedDatabaseFallback = false;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async getState(): Promise<MaintenanceState> {
    const databaseState = await this.readFromDatabase();
    if (databaseState) {
      return databaseState;
    }

    return this.readFromFile();
  }

  async setState(update: MaintenanceStateUpdate): Promise<MaintenanceState> {
    const current = await this.getState();
    const nextScope = update.enabled ? (update.scope ?? "all") : (update.scope ?? current.scope);
    const next = this.normalizeState(
      {
        enabled: update.enabled,
        updatedAt: new Date().toISOString(),
        reason: update.reason ?? current.reason,
        enabledBy: update.enabledBy ?? current.enabledBy,
        scope: nextScope
      },
      current
    );

    const wroteToDatabase = await this.writeToDatabase(next);
    if (!wroteToDatabase) {
      await this.writeToFile(next);
      return next;
    }

    const persisted = await this.readFromDatabase();
    return persisted ?? next;
  }

  private normalizeState(
    raw: {
      enabled?: unknown;
      updatedAt?: unknown;
      reason?: unknown;
      enabledBy?: unknown;
      scope?: unknown;
    },
    fallback = buildDefaultMaintenanceState()
  ): MaintenanceState {
    const enabled = raw.enabled === true;
    const reason = normalizeReason(raw.reason, fallback.reason);
    const scope = normalizeScope(raw.scope, fallback.scope);
    const enabledBy = normalizeEnabledBy(raw.enabledBy);

    return {
      enabled,
      updatedAt: normalizeUpdatedAt(raw.updatedAt, fallback.updatedAt),
      reason,
      enabledBy,
      scope
    };
  }

  private async readFromDatabase(): Promise<MaintenanceState | null> {
    try {
      await this.prisma.$executeRaw`
        INSERT INTO "MaintenanceState" ("id", "enabled", "updatedAt", "reason", "enabledBy", "scope")
        VALUES (1, false, NOW(), ${DEFAULT_MAINTENANCE_REASON}, NULL, 'all')
        ON CONFLICT ("id") DO NOTHING
      `;

      const rows = await this.prisma.$queryRaw<MaintenanceRow[]>`
        SELECT "enabled", "updatedAt", "reason", "enabledBy", "scope"
        FROM "MaintenanceState"
        WHERE "id" = 1
        LIMIT 1
      `;
      const row = rows[0];
      if (!row) {
        return buildDefaultMaintenanceState();
      }

      return this.normalizeState(
        {
          enabled: row.enabled,
          updatedAt: row.updatedAt.toISOString(),
          reason: row.reason,
          enabledBy: row.enabledBy ?? undefined,
          scope: row.scope
        },
        buildDefaultMaintenanceState(row.updatedAt)
      );
    } catch (error) {
      if (this.shouldFallbackToFile(error)) {
        this.logDatabaseFallback(error);
        return null;
      }
      throw error;
    }
  }

  private async writeToDatabase(state: MaintenanceState): Promise<boolean> {
    try {
      await this.prisma.$executeRaw`
        INSERT INTO "MaintenanceState" ("id", "enabled", "updatedAt", "reason", "enabledBy", "scope")
        VALUES (
          1,
          ${state.enabled},
          ${new Date(state.updatedAt)},
          ${state.reason},
          ${state.enabledBy ?? null},
          ${state.scope}
        )
        ON CONFLICT ("id")
        DO UPDATE SET
          "enabled" = EXCLUDED."enabled",
          "updatedAt" = EXCLUDED."updatedAt",
          "reason" = EXCLUDED."reason",
          "enabledBy" = EXCLUDED."enabledBy",
          "scope" = EXCLUDED."scope"
      `;
      return true;
    } catch (error) {
      if (this.shouldFallbackToFile(error)) {
        this.logDatabaseFallback(error);
        return false;
      }
      throw error;
    }
  }

  private async readFromFile(): Promise<MaintenanceState> {
    const fallback = buildDefaultMaintenanceState();

    try {
      const raw = await readFile(this.maintenanceFilePath, "utf8");
      const parsed = JSON.parse(raw) as unknown;

      if (!isRecord(parsed)) {
        return fallback;
      }

      return this.normalizeState(parsed, fallback);
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? (error as NodeJS.ErrnoException).code
          : undefined;

      if (code === "ENOENT") {
        return fallback;
      }

      console.warn("[maintenance] failed to read maintenance file, using defaults");
      return fallback;
    }
  }

  private async writeToFile(state: MaintenanceState): Promise<void> {
    await mkdir(dirname(this.maintenanceFilePath), { recursive: true });
    await writeFile(this.maintenanceFilePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }

  private shouldFallbackToFile(error: unknown): boolean {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? (error as ErrorWithCode).code
        : undefined;

    if (
      code === "P1001" ||
      code === "P1008" ||
      code === "P1017" ||
      code === "P2010" ||
      code === "P2021"
    ) {
      return true;
    }

    const message =
      error instanceof Error
        ? error.message.toLowerCase()
        : typeof error === "string"
          ? error.toLowerCase()
          : "";

    return (
      message.includes(`relation "maintenancestate" does not exist`) ||
      message.includes(`table "maintenancestate" does not exist`) ||
      message.includes("can't reach database server") ||
      message.includes("database schema is not yet initialized")
    );
  }

  private logDatabaseFallback(error: unknown): void {
    if (this.hasLoggedDatabaseFallback) {
      return;
    }

    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "unknown database error";

    console.warn(
      `[maintenance] database storage unavailable; using file fallback at ${this.maintenanceFilePath}: ${message}`
    );
    this.hasLoggedDatabaseFallback = true;
  }
}

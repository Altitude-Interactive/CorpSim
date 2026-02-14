import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { Inject, Injectable } from "@nestjs/common";
import type { DatabaseSchemaReadiness } from "@corpsim/shared";
import { PrismaService } from "../prisma/prisma.service";

const requireFromApi = createRequire(__filename);
const READINESS_CACHE_TTL_MS = 2_000;

interface MigrationRow {
  migration_name: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
}

function resolveMigrationsDirectory(): string | null {
  const explicit = process.env.PRISMA_MIGRATIONS_DIR?.trim();
  if (explicit) {
    const explicitPath = resolve(explicit);
    if (existsSync(explicitPath)) {
      return explicitPath;
    }
  }

  const candidates: string[] = [];

  try {
    const dbPackageJsonPath = requireFromApi.resolve("@corpsim/db/package.json");
    candidates.push(resolve(dirname(dbPackageJsonPath), "prisma", "migrations"));
  } catch {
    // Workspace package resolution failed; fallback candidates below.
  }

  candidates.push(
    resolve(process.cwd(), "packages", "db", "prisma", "migrations"),
    resolve(process.cwd(), "..", "..", "packages", "db", "prisma", "migrations"),
    resolve(__dirname, "..", "..", "..", "..", "packages", "db", "prisma", "migrations")
  );

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function listLocalMigrationNames(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function isTableMissingError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const lowered = error.message.toLowerCase();
  if (lowered.includes('relation "_prisma_migrations" does not exist')) {
    return true;
  }

  const asObject = error as { code?: unknown; meta?: { code?: unknown } };
  return asObject.code === "42P01" || asObject.meta?.code === "42P01";
}

function isConnectivityError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const lowered = error.message.toLowerCase();
  if (lowered.includes("can't reach database server")) {
    return true;
  }

  const asObject = error as { errorCode?: unknown; code?: unknown };
  return asObject.errorCode === "P1001" || asObject.code === "P1001";
}

@Injectable()
export class SchemaReadinessService {
  private cachedReadiness: DatabaseSchemaReadiness | null = null;

  private cacheExpiresAt = 0;

  private readonly migrationsDirectory: string | null = resolveMigrationsDirectory();

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getReadiness(): Promise<DatabaseSchemaReadiness> {
    const now = Date.now();
    if (this.cachedReadiness && now < this.cacheExpiresAt) {
      return this.cachedReadiness;
    }

    const readiness = await this.computeReadiness();
    this.cachedReadiness = readiness;
    this.cacheExpiresAt = now + READINESS_CACHE_TTL_MS;
    return readiness;
  }

  private async computeReadiness(): Promise<DatabaseSchemaReadiness> {
    const checkedAt = new Date().toISOString();

    if (!this.migrationsDirectory) {
      return {
        ready: false,
        status: "schema-check-failed",
        checkedAt,
        issues: ["Database update files were not found for this server build."],
        pendingMigrations: [],
        failedMigrations: [],
        extraDatabaseMigrations: []
      };
    }

    const localMigrationNames = listLocalMigrationNames(this.migrationsDirectory);
    if (localMigrationNames.length === 0) {
      return {
        ready: false,
        status: "schema-check-failed",
        checkedAt,
        issues: ["Database update files were not found for this server build."],
        pendingMigrations: [],
        failedMigrations: [],
        extraDatabaseMigrations: []
      };
    }

    let rows: MigrationRow[];

    try {
      rows = await this.prisma.$queryRawUnsafe<MigrationRow[]>(
        `SELECT "migration_name", "finished_at", "rolled_back_at" FROM "_prisma_migrations" ORDER BY "migration_name" ASC`
      );
    } catch (error) {
      if (isTableMissingError(error)) {
        return {
          ready: false,
          status: "schema-check-failed",
          checkedAt,
          issues: ["Database update history is missing. Apply migrations before starting the game."],
          pendingMigrations: localMigrationNames,
          failedMigrations: [],
          extraDatabaseMigrations: []
        };
      }

      if (isConnectivityError(error)) {
        return {
          ready: false,
          status: "schema-check-failed",
          checkedAt,
          issues: ["Database connection failed during startup checks."],
          pendingMigrations: [],
          failedMigrations: [],
          extraDatabaseMigrations: []
        };
      }

      return {
        ready: false,
        status: "schema-check-failed",
        checkedAt,
        issues: ["Database readiness checks failed. Review server logs and apply updates."],
        pendingMigrations: [],
        failedMigrations: [],
        extraDatabaseMigrations: []
      };
    }

    const appliedNames = rows
      .filter((row) => row.finished_at !== null && row.rolled_back_at === null)
      .map((row) => row.migration_name);
    const failedNames = rows
      .filter((row) => row.finished_at === null && row.rolled_back_at === null)
      .map((row) => row.migration_name);

    const appliedNameSet = new Set(appliedNames);
    const localNameSet = new Set(localMigrationNames);

    const pendingMigrations = localMigrationNames.filter((name) => !appliedNameSet.has(name));
    const extraDatabaseMigrations = appliedNames.filter((name) => !localNameSet.has(name));

    const issues: string[] = [];
    if (pendingMigrations.length > 0) {
      issues.push("A database update is required before the game can start.");
    }
    if (failedNames.length > 0) {
      issues.push("One or more database updates did not finish correctly.");
    }
    if (extraDatabaseMigrations.length > 0) {
      issues.push("Database update history does not match this game build.");
    }

    return {
      ready: issues.length === 0,
      status: issues.length === 0 ? "ready" : "schema-out-of-date",
      checkedAt,
      issues,
      pendingMigrations,
      failedMigrations: failedNames,
      extraDatabaseMigrations
    };
  }
}

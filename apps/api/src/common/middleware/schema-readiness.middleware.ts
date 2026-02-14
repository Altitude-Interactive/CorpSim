import { Inject, Injectable, NestMiddleware } from "@nestjs/common";
import { SchemaReadinessService } from "../../schema-readiness/schema-readiness.service";

interface SchemaReadinessRequest {
  originalUrl?: string;
  url?: string;
}

interface SchemaReadinessResponse {
  status(code: number): SchemaReadinessResponse;
  json(payload: unknown): void;
}

function getRequestPath(request: SchemaReadinessRequest): string {
  const rawPath = request.originalUrl || request.url || "/";
  const querySeparatorIndex = rawPath.indexOf("?");
  return querySeparatorIndex >= 0 ? rawPath.slice(0, querySeparatorIndex) : rawPath;
}

function isGameApiPath(path: string): boolean {
  return path === "/v1" || path.startsWith("/v1/");
}

function isSchemaReadinessEnforced(): boolean {
  const raw = process.env.ENFORCE_SCHEMA_READINESS?.trim().toLowerCase();
  if (raw === "true") {
    return true;
  }
  if (raw === "false") {
    return false;
  }

  return process.env.NODE_ENV !== "test";
}

@Injectable()
export class SchemaReadinessMiddleware implements NestMiddleware {
  constructor(
    @Inject(SchemaReadinessService) private readonly schemaReadinessService: SchemaReadinessService
  ) {}

  async use(
    request: SchemaReadinessRequest,
    response: SchemaReadinessResponse,
    next: () => void
  ): Promise<void> {
    const path = getRequestPath(request);
    if (!isGameApiPath(path)) {
      next();
      return;
    }

    if (!isSchemaReadinessEnforced()) {
      next();
      return;
    }

    try {
      const readiness = await this.schemaReadinessService.getReadiness();
      if (readiness.ready) {
        next();
        return;
      }

      response.status(503).json({
        error: "SCHEMA_NOT_READY",
        message: "Database updates are required before the game can load.",
        status: readiness.status,
        checkedAt: readiness.checkedAt,
        issues: readiness.issues,
        pendingMigrations: readiness.pendingMigrations,
        failedMigrations: readiness.failedMigrations,
        extraDatabaseMigrations: readiness.extraDatabaseMigrations
      });
    } catch {
      response.status(503).json({
        error: "SCHEMA_NOT_READY",
        message: "Database readiness checks failed before loading game data."
      });
    }
  }
}

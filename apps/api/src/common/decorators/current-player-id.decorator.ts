import {
  ForbiddenException,
  UnauthorizedException,
  createParamDecorator,
  ExecutionContext
} from "@nestjs/common";
import type { UserSession } from "@thallesp/nestjs-better-auth";

interface RequestWithSession {
  session?: UserSession | null;
  method?: string;
  url?: string;
  originalUrl?: string;
  path?: string;
}

function isAdminRole(role: string | string[] | null | undefined): boolean {
  if (!role) {
    return false;
  }
  const roleValues = Array.isArray(role) ? role : role.split(",");
  return roleValues
    .map((entry) => entry.trim().toLowerCase())
    .some((entry) => entry === "admin");
}

const ADMIN_ALLOWED_READ_PATH_PREFIXES = [
  "/v1/companies",
  "/v1/items",
  "/v1/production/recipes",
  "/v1/research"
] as const;

function resolveRequestPath(request: RequestWithSession): string {
  const rawPath = request.originalUrl ?? request.path ?? request.url ?? "";
  const pathWithoutQuery = rawPath.split("?", 1)[0] ?? "";
  const normalized = pathWithoutQuery.trim();
  return normalized.length > 0 ? normalized : "/";
}

export function canAdminAccessPlayerGameplayEndpoint(request: RequestWithSession): boolean {
  const method = request.method?.trim().toUpperCase();
  if (method !== "GET") {
    return false;
  }

  const path = resolveRequestPath(request);
  return ADMIN_ALLOWED_READ_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

function resolveTestFallbackPlayerId(): string | null {
  if (process.env.NODE_ENV !== "test") {
    return null;
  }
  if (process.env.AUTH_ENFORCE_GUARD_IN_TESTS === "true") {
    return null;
  }
  return process.env.AUTH_TEST_FALLBACK_PLAYER_ID?.trim() || "player_seed";
}

export const CurrentPlayerId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<RequestWithSession>();
    const playerId = request.session?.user?.id;
    if (!playerId) {
      const fallbackPlayerId = resolveTestFallbackPlayerId();
      if (fallbackPlayerId) {
        return fallbackPlayerId;
      }
      throw new UnauthorizedException("missing authenticated user session");
    }

    if (isAdminRole(request.session?.user?.role)) {
      if (canAdminAccessPlayerGameplayEndpoint(request)) {
        return playerId;
      }
      throw new ForbiddenException("Admin accounts cannot access player gameplay endpoints.");
    }
    return playerId;
  }
);

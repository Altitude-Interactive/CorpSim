import { UnauthorizedException, createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { UserSession } from "@thallesp/nestjs-better-auth";

interface RequestWithSession {
  session?: UserSession | null;
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
    return playerId;
  }
);

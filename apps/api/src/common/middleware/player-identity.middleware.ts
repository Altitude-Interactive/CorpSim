import { Injectable, NestMiddleware } from "@nestjs/common";

export const PLAYER_HANDLE_HEADER = "x-player-handle";
export const DEFAULT_PLAYER_HANDLE = "PLAYER";

export interface PlayerIdentityRequest {
  headers: Record<string, string | string[] | undefined>;
  playerHandle?: string;
}

@Injectable()
export class PlayerIdentityMiddleware implements NestMiddleware {
  use(req: PlayerIdentityRequest, _res: unknown, next: () => void): void {
    const rawHeader = req.headers[PLAYER_HANDLE_HEADER];
    const headerValue = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    const resolved = headerValue?.trim() || DEFAULT_PLAYER_HANDLE;
    req.playerHandle = resolved;
    next();
  }
}

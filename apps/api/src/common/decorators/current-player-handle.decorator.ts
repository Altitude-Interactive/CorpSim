import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import {
  DEFAULT_PLAYER_HANDLE,
  PlayerIdentityRequest
} from "../middleware/player-identity.middleware";

export const CurrentPlayerHandle = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<PlayerIdentityRequest>();
    return request.playerHandle ?? DEFAULT_PLAYER_HANDLE;
  }
);

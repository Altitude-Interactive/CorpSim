import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Post,
  Query,
  ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { timingSafeCompare } from "../common/utils/timing-safe-compare";
import { AdvanceWorldDto } from "./dto/advance-world.dto";
import { ResetWorldBodyDto, ResetWorldQueryDto } from "./dto/reset-world.dto";
import { WorldService } from "./world.service";

function readBearerToken(headerValue: string | undefined): string | undefined {
  if (!headerValue) {
    return undefined;
  }

  const [scheme, token] = headerValue.trim().split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return undefined;
  }

  const trimmed = token.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function assertOperatorTokenInProduction(authorizationHeader?: string): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const configuredToken = process.env.CORPSIM_OPS_TOKEN?.trim();
  if (!configuredToken) {
    throw new ServiceUnavailableException("Operator token is not configured");
  }

  const providedToken = readBearerToken(authorizationHeader);
  if (!providedToken || !timingSafeCompare(providedToken, configuredToken)) {
    throw new UnauthorizedException("Invalid operator token");
  }
}

function resolveReseedFlag(query?: string, body?: boolean): boolean {
  const queryValue = query === undefined ? undefined : query === "true";

  if (query !== undefined && body !== undefined && queryValue !== body) {
    throw new BadRequestException("reseed query and body values must match when both are provided");
  }

  if (body !== undefined) {
    return body;
  }

  if (query !== undefined) {
    return queryValue === true;
  }

  return true;
}

@Controller("v1/world")
export class WorldController {
  private readonly worldService: WorldService;

  constructor(@Inject(WorldService) worldService: WorldService) {
    this.worldService = worldService;
  }

  @Get("tick")
  async getTick() {
    return this.worldService.getTickState();
  }

  @Get("health")
  @AllowAnonymous()
  async getHealth() {
    return this.worldService.getHealth();
  }

  @Post("advance")
  async advance(
    @Body() body: AdvanceWorldDto,
    @Headers("authorization") authorizationHeader?: string
  ) {
    assertOperatorTokenInProduction(authorizationHeader);
    return this.worldService.advance(body.ticks, body.expectedLockVersion);
  }

  @Post("reset")
  async reset(
    @Query() query: ResetWorldQueryDto,
    @Body() body: ResetWorldBodyDto = {},
    @Headers("authorization") authorizationHeader?: string
  ) {
    assertOperatorTokenInProduction(authorizationHeader);
    const reseed = resolveReseedFlag(query.reseed, body.reseed);
    return this.worldService.reset(reseed);
  }
}

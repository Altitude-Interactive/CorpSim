import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query
} from "@nestjs/common";
import { AdvanceWorldDto } from "./dto/advance-world.dto";
import { ResetWorldBodyDto, ResetWorldQueryDto } from "./dto/reset-world.dto";
import { WorldService } from "./world.service";

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
  async getHealth() {
    return this.worldService.getHealth();
  }

  @Post("advance")
  async advance(@Body() body: AdvanceWorldDto) {
    return this.worldService.advance(body.ticks, body.expectedLockVersion);
  }

  @Post("reset")
  async reset(
    @Query() query: ResetWorldQueryDto,
    @Body() body: ResetWorldBodyDto = {}
  ) {
    const reseed = resolveReseedFlag(query.reseed, body.reseed);
    return this.worldService.reset(reseed);
  }
}

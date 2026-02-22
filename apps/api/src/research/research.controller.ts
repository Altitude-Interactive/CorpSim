import { Body, Controller, Get, Inject, Param, Post, Query, Req } from "@nestjs/common";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { CurrentPlayerId } from "../common/decorators/current-player-id.decorator";
import { ListResearchDto } from "./dto/list-research.dto";
import { MutateResearchDto } from "./dto/mutate-research.dto";
import { ResearchNodeParamDto } from "./dto/research-node-param.dto";
import { ResearchService } from "./research.service";

interface RequestWithSession {
  session?: UserSession | null;
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

@Controller("v1/research")
export class ResearchController {
  private readonly researchService: ResearchService;

  constructor(@Inject(ResearchService) researchService: ResearchService) {
    this.researchService = researchService;
  }

  @Get()
  async list(
    @Query() query: ListResearchDto,
    @Req() request: RequestWithSession,
    @CurrentPlayerId() playerId: string
  ) {
    if (isAdminRole(request.session?.user?.role)) {
      return this.researchService.listResearchForAdminCatalog(query.companyId);
    }

    return this.researchService.listResearch(query.companyId, playerId);
  }

  @Post(":nodeId/start")
  async start(
    @Param() params: ResearchNodeParamDto,
    @Body() body: MutateResearchDto,
    @CurrentPlayerId() playerId: string
  ) {
    return this.researchService.startNode(params.nodeId, body.companyId, playerId);
  }

  @Post(":nodeId/cancel")
  async cancel(
    @Param() params: ResearchNodeParamDto,
    @Body() body: MutateResearchDto,
    @CurrentPlayerId() playerId: string
  ) {
    return this.researchService.cancelNode(params.nodeId, body.companyId, playerId);
  }
}

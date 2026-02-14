import { Body, Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import { CurrentPlayerId } from "../common/decorators/current-player-id.decorator";
import { ListResearchDto } from "./dto/list-research.dto";
import { MutateResearchDto } from "./dto/mutate-research.dto";
import { ResearchNodeParamDto } from "./dto/research-node-param.dto";
import { ResearchService } from "./research.service";

@Controller("v1/research")
export class ResearchController {
  private readonly researchService: ResearchService;

  constructor(@Inject(ResearchService) researchService: ResearchService) {
    this.researchService = researchService;
  }

  @Get()
  async list(
    @Query() query: ListResearchDto,
    @CurrentPlayerId() playerId: string
  ) {
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

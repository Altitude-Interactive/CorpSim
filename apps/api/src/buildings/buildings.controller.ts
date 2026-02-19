import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Query
} from "@nestjs/common";
import { CurrentPlayerId } from "../common/decorators/current-player-id.decorator";
import { AcquireBuildingDto } from "./dto/acquire-building.dto";
import { ListBuildingsDto } from "./dto/list-buildings.dto";
import { ReactivateBuildingDto } from "./dto/reactivate-building.dto";
import { PreflightProductionJobDto } from "./dto/preflight-production-job.dto";
import { PreflightBuyOrderDto } from "./dto/preflight-buy-order.dto";
import { BuildingsService } from "./buildings.service";

@Controller("v1/buildings")
export class BuildingsController {
  private readonly buildingsService: BuildingsService;

  constructor(@Inject(BuildingsService) buildingsService: BuildingsService) {
    this.buildingsService = buildingsService;
  }

  @Get()
  async listBuildings(
    @Query() query: ListBuildingsDto,
    @CurrentPlayerId() playerId: string
  ) {
    return this.buildingsService.listBuildings(query, playerId);
  }

  @Post("acquire")
  async acquireBuilding(
    @Body() body: AcquireBuildingDto,
    @CurrentPlayerId() playerId: string
  ) {
    return this.buildingsService.acquireBuilding(
      {
        companyId: body.companyId,
        regionId: body.regionId,
        buildingType: body.buildingType,
        name: body.name
      },
      playerId
    );
  }

  @Post("reactivate")
  @HttpCode(HttpStatus.OK)
  async reactivateBuilding(
    @Body() body: ReactivateBuildingDto,
    @CurrentPlayerId() playerId: string
  ) {
    return this.buildingsService.reactivateBuilding(body.buildingId, playerId);
  }

  @Get("storage-info")
  async getStorageInfo(
    @Query("companyId") companyId: string,
    @Query("regionId") regionId: string,
    @CurrentPlayerId() playerId: string
  ) {
    return this.buildingsService.getRegionalStorageInfo(companyId, regionId, playerId);
  }

  @Get("capacity-info")
  async getCapacityInfo(
    @Query("companyId") companyId: string,
    @CurrentPlayerId() playerId: string
  ) {
    return this.buildingsService.getProductionCapacityInfo(companyId, playerId);
  }

  @Post("preflight/production-job")
  @HttpCode(HttpStatus.OK)
  async preflightProductionJob(
    @Body() body: PreflightProductionJobDto,
    @CurrentPlayerId() playerId: string
  ) {
    return this.buildingsService.preflightProductionJob(
      {
        companyId: body.companyId,
        recipeId: body.recipeId,
        quantity: body.quantity
      },
      playerId
    );
  }

  @Post("preflight/buy-order")
  @HttpCode(HttpStatus.OK)
  async preflightBuyOrder(
    @Body() body: PreflightBuyOrderDto,
    @CurrentPlayerId() playerId: string
  ) {
    return this.buildingsService.preflightBuyOrder(
      {
        companyId: body.companyId,
        regionId: body.regionId,
        itemId: body.itemId,
        quantity: body.quantity
      },
      playerId
    );
  }

  @Get("definitions")
  async getBuildingTypeDefinitions() {
    const definitions = await this.buildingsService.getBuildingTypeDefinitions();
    return { definitions };
  }
}

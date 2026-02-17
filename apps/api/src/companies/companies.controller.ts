import { Body, Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import { CurrentPlayerId } from "../common/decorators/current-player-id.decorator";
import { CompanyParamDto } from "./dto/company-param.dto";
import { ListCompanyInventoryDto } from "./dto/list-company-inventory.dto";
import { SetCompanySpecializationDto } from "./dto/set-company-specialization.dto";
import { CompaniesService } from "./companies.service";

@Controller("v1/companies")
export class CompaniesController {
  private readonly companiesService: CompaniesService;

  constructor(@Inject(CompaniesService) companiesService: CompaniesService) {
    this.companiesService = companiesService;
  }

  @Get()
  async list(@CurrentPlayerId() playerId: string) {
    return this.companiesService.listCompanies(playerId);
  }

  @Get("specializations")
  async listSpecializations() {
    return this.companiesService.listSpecializationOptions();
  }

  @Get(":id")
  async getOne(
    @Param() params: CompanyParamDto,
    @CurrentPlayerId() playerId: string
  ) {
    return this.companiesService.getCompany(params.id, playerId);
  }

  @Get(":id/inventory")
  async getInventory(
    @Param() params: CompanyParamDto,
    @Query() query: ListCompanyInventoryDto,
    @CurrentPlayerId() playerId: string
  ) {
    return this.companiesService.getInventory(params.id, playerId, query.regionId);
  }

  @Post(":id/specialization")
  async setSpecialization(
    @Param() params: CompanyParamDto,
    @Body() body: SetCompanySpecializationDto,
    @CurrentPlayerId() playerId: string
  ) {
    return this.companiesService.setSpecialization(
      params.id,
      body.specialization,
      playerId
    );
  }
}

import { Body, Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import { CurrentPlayerHandle } from "../common/decorators/current-player-handle.decorator";
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
  async list() {
    return this.companiesService.listCompanies();
  }

  @Get("specializations")
  async listSpecializations() {
    return this.companiesService.listSpecializationOptions();
  }

  @Get(":id")
  async getOne(
    @Param() params: CompanyParamDto,
    @CurrentPlayerHandle() playerHandle: string
  ) {
    return this.companiesService.getCompany(params.id, playerHandle);
  }

  @Get(":id/inventory")
  async getInventory(
    @Param() params: CompanyParamDto,
    @Query() query: ListCompanyInventoryDto,
    @CurrentPlayerHandle() playerHandle: string
  ) {
    return this.companiesService.getInventory(params.id, playerHandle, query.regionId);
  }

  @Post(":id/specialization")
  async setSpecialization(
    @Param() params: CompanyParamDto,
    @Body() body: SetCompanySpecializationDto,
    @CurrentPlayerHandle() playerHandle: string
  ) {
    return this.companiesService.setSpecialization(
      params.id,
      body.specialization,
      playerHandle
    );
  }
}

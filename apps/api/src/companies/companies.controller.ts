import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { CurrentPlayerHandle } from "../common/decorators/current-player-handle.decorator";
import { CompanyParamDto } from "./dto/company-param.dto";
import { ListCompanyInventoryDto } from "./dto/list-company-inventory.dto";
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
}

import { Controller, Get, Inject } from "@nestjs/common";
import { RegionsService } from "./regions.service";

@Controller("v1/regions")
export class RegionsController {
  private readonly regionsService: RegionsService;

  constructor(@Inject(RegionsService) regionsService: RegionsService) {
    this.regionsService = regionsService;
  }

  @Get()
  async listRegions() {
    return this.regionsService.listRegions();
  }
}

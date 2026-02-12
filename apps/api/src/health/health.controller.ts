import { Controller, Get, Inject } from "@nestjs/common";
import { MaintenanceService } from "../maintenance/maintenance.service";

@Controller("health")
export class HealthController {
  private readonly maintenanceService: MaintenanceService;

  constructor(@Inject(MaintenanceService) maintenanceService: MaintenanceService) {
    this.maintenanceService = maintenanceService;
  }

  @Get()
  health() {
    return {
      status: "ok",
      service: "api"
    };
  }

  @Get("maintenance")
  async maintenance() {
    return this.maintenanceService.getState();
  }
}

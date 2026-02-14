import { Controller, Get, Inject } from "@nestjs/common";
import { MaintenanceService } from "../maintenance/maintenance.service";
import { SchemaReadinessService } from "../schema-readiness/schema-readiness.service";

@Controller("health")
export class HealthController {
  private readonly maintenanceService: MaintenanceService;
  private readonly schemaReadinessService: SchemaReadinessService;

  constructor(
    @Inject(MaintenanceService) maintenanceService: MaintenanceService,
    @Inject(SchemaReadinessService) schemaReadinessService: SchemaReadinessService
  ) {
    this.maintenanceService = maintenanceService;
    this.schemaReadinessService = schemaReadinessService;
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

  @Get("readiness")
  async readiness() {
    return this.schemaReadinessService.getReadiness();
  }
}

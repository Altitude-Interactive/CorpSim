import {
  Body,
  Controller,
  Headers,
  Inject,
  Post,
  ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { UpdateMaintenanceDto } from "../maintenance/dto/update-maintenance.dto";
import { MaintenanceService } from "../maintenance/maintenance.service";
import { WorldService } from "../world/world.service";

function readBearerToken(headerValue: string | undefined): string | undefined {
  if (!headerValue) {
    return undefined;
  }

  const [scheme, token] = headerValue.trim().split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return undefined;
  }

  const trimmed = token.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

@AllowAnonymous()
@Controller("ops")
export class OpsController {
  private readonly maintenanceService: MaintenanceService;
  private readonly worldService: WorldService;

  constructor(
    @Inject(MaintenanceService) maintenanceService: MaintenanceService,
    @Inject(WorldService) worldService: WorldService
  ) {
    this.maintenanceService = maintenanceService;
    this.worldService = worldService;
  }

  @Post("maintenance")
  async updateMaintenance(
    @Body() body: UpdateMaintenanceDto,
    @Headers("authorization") authorizationHeader?: string
  ) {
    this.assertAuthorizedInProduction(authorizationHeader);
    return this.maintenanceService.setState(body);
  }

  @Post("simulation/control/reset")
  async resetSimulationControl(@Headers("authorization") authorizationHeader?: string) {
    this.assertAuthorizedInProduction(authorizationHeader);
    return this.worldService.resetSimulationControlState();
  }

  private assertAuthorizedInProduction(authorizationHeader?: string): void {
    if (process.env.NODE_ENV !== "production") {
      return;
    }

    const configuredToken = process.env.CORPSIM_OPS_TOKEN?.trim();
    if (!configuredToken) {
      throw new ServiceUnavailableException("Operator token is not configured");
    }

    const providedToken = readBearerToken(authorizationHeader);
    if (!providedToken || providedToken !== configuredToken) {
      throw new UnauthorizedException("Invalid operator token");
    }
  }
}

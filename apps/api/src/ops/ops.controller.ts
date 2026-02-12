import {
  Body,
  Controller,
  Headers,
  Inject,
  Post,
  ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common";
import { UpdateMaintenanceDto } from "../maintenance/dto/update-maintenance.dto";
import { MaintenanceService } from "../maintenance/maintenance.service";

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

@Controller("ops")
export class OpsController {
  private readonly maintenanceService: MaintenanceService;

  constructor(@Inject(MaintenanceService) maintenanceService: MaintenanceService) {
    this.maintenanceService = maintenanceService;
  }

  @Post("maintenance")
  async updateMaintenance(
    @Body() body: UpdateMaintenanceDto,
    @Headers("authorization") authorizationHeader?: string
  ) {
    this.assertAuthorizedInProduction(authorizationHeader);
    return this.maintenanceService.setState(body);
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

import { Inject, Injectable, NestMiddleware } from "@nestjs/common";
import { MaintenanceService } from "../../maintenance/maintenance.service";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

interface MaintenanceModeRequest {
  method: string;
  originalUrl?: string;
  url?: string;
}

interface MaintenanceModeResponse {
  status(code: number): MaintenanceModeResponse;
  json(payload: unknown): void;
}

function getRequestPath(request: MaintenanceModeRequest): string {
  const rawPath = request.originalUrl || request.url || "/";
  const querySeparatorIndex = rawPath.indexOf("?");
  return querySeparatorIndex >= 0 ? rawPath.slice(0, querySeparatorIndex) : rawPath;
}

function isMaintenanceBypassPath(path: string): boolean {
  return path === "/ops/maintenance" || path.startsWith("/ops/maintenance/");
}

@Injectable()
export class MaintenanceModeMiddleware implements NestMiddleware {
  private readonly maintenanceService: MaintenanceService;

  constructor(@Inject(MaintenanceService) maintenanceService: MaintenanceService) {
    this.maintenanceService = maintenanceService;
  }

  async use(
    request: MaintenanceModeRequest,
    response: MaintenanceModeResponse,
    next: () => void
  ): Promise<void> {
    const method = request.method.toUpperCase();
    if (!WRITE_METHODS.has(method)) {
      next();
      return;
    }

    const path = getRequestPath(request);
    if (isMaintenanceBypassPath(path)) {
      next();
      return;
    }

    try {
      const state = await this.maintenanceService.getState();
      if (!state.enabled || state.scope !== "all") {
        next();
        return;
      }

      response.status(503).json({
        error: "MAINTENANCE",
        message: "Maintenance mode enabled",
        updatedAt: state.updatedAt,
        reason: state.reason
      });
    } catch {
      next();
    }
  }
}

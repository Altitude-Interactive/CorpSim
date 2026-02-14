import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { MaintenanceModeMiddleware } from "./common/middleware/maintenance-mode.middleware";
import { SchemaReadinessMiddleware } from "./common/middleware/schema-readiness.middleware";
import { CompaniesController } from "./companies/companies.controller";
import { CompaniesService } from "./companies/companies.service";
import { ContractsController } from "./contracts/contracts.controller";
import { ContractsService } from "./contracts/contracts.service";
import { HealthController } from "./health/health.controller";
import { FinanceController } from "./finance/finance.controller";
import { FinanceService } from "./finance/finance.service";
import { ItemsController } from "./items/items.controller";
import { ItemsService } from "./items/items.service";
import { MarketController } from "./market/market.controller";
import { MarketService } from "./market/market.service";
import { MaintenanceService } from "./maintenance/maintenance.service";
import { MetaController } from "./meta/meta.controller";
import { OpsController } from "./ops/ops.controller";
import { OnboardingController } from "./onboarding/onboarding.controller";
import { OnboardingService } from "./onboarding/onboarding.service";
import { PlayersController } from "./players/players.controller";
import { PlayersService } from "./players/players.service";
import { PrismaService } from "./prisma/prisma.service";
import { ProductionController } from "./production/production.controller";
import { ProductionService } from "./production/production.service";
import { RegionsController } from "./regions/regions.controller";
import { RegionsService } from "./regions/regions.service";
import { ResearchController } from "./research/research.controller";
import { ResearchService } from "./research/research.service";
import { RootController } from "./root.controller";
import { SchemaReadinessService } from "./schema-readiness/schema-readiness.service";
import { ShipmentsController } from "./shipments/shipments.controller";
import { ShipmentsService } from "./shipments/shipments.service";
import { WorldController } from "./world/world.controller";
import { WorldService } from "./world/world.service";
import { WorkforceController } from "./workforce/workforce.controller";
import { WorkforceService } from "./workforce/workforce.service";
import { auth } from "./lib/auth";

@Module({
  imports: [
    AuthModule.forRoot({
      auth,
      disableTrustedOriginsCors: true,
      disableGlobalAuthGuard:
        process.env.NODE_ENV === "test" && process.env.AUTH_ENFORCE_GUARD_IN_TESTS !== "true"
    })
  ],
  controllers: [
    RootController,
    MetaController,
    HealthController,
    OpsController,
    OnboardingController,
    WorldController,
    FinanceController,
    ContractsController,
    PlayersController,
    CompaniesController,
    MarketController,
    ItemsController,
    RegionsController,
    ShipmentsController,
    ProductionController,
    ResearchController,
    WorkforceController
  ],
  providers: [
    PrismaService,
    SchemaReadinessMiddleware,
    MaintenanceModeMiddleware,
    SchemaReadinessService,
    WorldService,
    FinanceService,
    ContractsService,
    CompaniesService,
    PlayersService,
    MarketService,
    MaintenanceService,
    OnboardingService,
    ItemsService,
    RegionsService,
    ShipmentsService,
    ProductionService,
    ResearchService,
    WorkforceService
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(SchemaReadinessMiddleware, MaintenanceModeMiddleware)
      .forRoutes("*");
  }
}

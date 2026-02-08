import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { PlayerIdentityMiddleware } from "./common/middleware/player-identity.middleware";
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
import { PlayersController } from "./players/players.controller";
import { PlayersService } from "./players/players.service";
import { PrismaService } from "./prisma/prisma.service";
import { ProductionController } from "./production/production.controller";
import { ProductionService } from "./production/production.service";
import { ResearchController } from "./research/research.controller";
import { ResearchService } from "./research/research.service";
import { RootController } from "./root.controller";
import { WorldController } from "./world/world.controller";
import { WorldService } from "./world/world.service";

@Module({
  imports: [],
  controllers: [
    RootController,
    HealthController,
    WorldController,
    FinanceController,
    ContractsController,
    PlayersController,
    CompaniesController,
    MarketController,
    ItemsController,
    ProductionController,
    ResearchController
  ],
  providers: [
    PrismaService,
    WorldService,
    FinanceService,
    ContractsService,
    CompaniesService,
    PlayersService,
    MarketService,
    ItemsService,
    ProductionService,
    ResearchService
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(PlayerIdentityMiddleware).forRoutes("*");
  }
}

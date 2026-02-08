import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { PlayerIdentityMiddleware } from "./common/middleware/player-identity.middleware";
import { CompaniesController } from "./companies/companies.controller";
import { CompaniesService } from "./companies/companies.service";
import { HealthController } from "./health/health.controller";
import { ItemsController } from "./items/items.controller";
import { ItemsService } from "./items/items.service";
import { MarketController } from "./market/market.controller";
import { MarketService } from "./market/market.service";
import { PlayersController } from "./players/players.controller";
import { PlayersService } from "./players/players.service";
import { PrismaService } from "./prisma/prisma.service";
import { ProductionController } from "./production/production.controller";
import { ProductionService } from "./production/production.service";
import { RootController } from "./root.controller";
import { WorldController } from "./world/world.controller";
import { WorldService } from "./world/world.service";

@Module({
  imports: [],
  controllers: [
    RootController,
    HealthController,
    WorldController,
    PlayersController,
    CompaniesController,
    MarketController,
    ItemsController,
    ProductionController
  ],
  providers: [
    PrismaService,
    WorldService,
    CompaniesService,
    PlayersService,
    MarketService,
    ItemsService,
    ProductionService
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(PlayerIdentityMiddleware).forRoutes("*");
  }
}

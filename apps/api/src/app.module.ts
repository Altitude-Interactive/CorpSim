import { Module } from "@nestjs/common";
import { CompaniesController } from "./companies/companies.controller";
import { CompaniesService } from "./companies/companies.service";
import { HealthController } from "./health/health.controller";
import { MarketController } from "./market/market.controller";
import { MarketService } from "./market/market.service";
import { PrismaService } from "./prisma/prisma.service";
import { RootController } from "./root.controller";
import { WorldController } from "./world/world.controller";
import { WorldService } from "./world/world.service";

@Module({
  imports: [],
  controllers: [RootController, HealthController, WorldController, CompaniesController, MarketController],
  providers: [PrismaService, WorldService, CompaniesService, MarketService]
})
export class AppModule {}

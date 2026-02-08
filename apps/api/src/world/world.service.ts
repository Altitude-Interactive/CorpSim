import { Inject, Injectable } from "@nestjs/common";
import { seedWorld } from "../../../../packages/db/src/seed-world";
import {
  advanceSimulationTicks,
  getWorldTickState,
  resetSimulationData
} from "../../../../packages/sim/src";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class WorldService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async getTickState() {
    const tickState = await getWorldTickState(this.prisma);

    return {
      currentTick: tickState?.currentTick ?? 0,
      lockVersion: tickState?.lockVersion ?? 0,
      lastAdvancedAt: tickState?.lastAdvancedAt ?? null
    };
  }

  async advance(ticks: number) {
    await advanceSimulationTicks(this.prisma, ticks);
    return this.getTickState();
  }

  async reset(reseed: boolean) {
    await resetSimulationData(this.prisma);

    if (reseed) {
      await seedWorld(this.prisma, { reset: false });
    }

    return this.getTickState();
  }
}

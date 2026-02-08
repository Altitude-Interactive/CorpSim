import { Inject, Injectable } from "@nestjs/common";
import { seedWorld } from "../../../../packages/db/src/seed-world";
import {
  advanceSimulationTicks,
  getSimulationHealth,
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

  async getHealth() {
    const health = await getSimulationHealth(this.prisma, {
      invariantIssueLimit: 20
    });

    return {
      currentTick: health.currentTick,
      lockVersion: health.lockVersion,
      lastAdvancedAt: health.lastAdvancedAt,
      ordersOpenCount: health.ordersOpenCount,
      ordersTotalCount: health.ordersTotalCount,
      tradesLast100Count: health.tradesLast100Count,
      companiesCount: health.companiesCount,
      botsCount: health.botsCount,
      sumCashCents: health.sumCashCents.toString(),
      sumReservedCashCents: health.sumReservedCashCents.toString(),
      invariants: {
        hasViolations: health.invariants.hasViolations,
        truncated: health.invariants.truncated,
        issues: health.invariants.issues
      }
    };
  }

  async advance(ticks: number, expectedLockVersion?: number) {
    await advanceSimulationTicks(this.prisma, ticks, { expectedLockVersion });
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

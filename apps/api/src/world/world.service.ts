import { Inject, Injectable } from "@nestjs/common";
import type { WorldHealth, WorldTickState } from "@corpsim/shared";
import { seedWorld } from "@corpsim/db";
import {
  advanceSimulationTicks,
  getSimulationHealth,
  getWorldTickState,
  resetSimulationData
} from "@corpsim/sim";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class WorldService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async getTickState(): Promise<WorldTickState> {
    const tickState = await getWorldTickState(this.prisma);

    return {
      currentTick: tickState?.currentTick ?? 0,
      lockVersion: tickState?.lockVersion ?? 0,
      lastAdvancedAt: tickState?.lastAdvancedAt?.toISOString() ?? null
    };
  }

  async getHealth(): Promise<WorldHealth> {
    const health = await getSimulationHealth(this.prisma, {
      invariantIssueLimit: 20
    });

    return {
      currentTick: health.currentTick,
      lockVersion: health.lockVersion,
      lastAdvancedAt: health.lastAdvancedAt?.toISOString() ?? null,
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

  async advance(ticks: number, expectedLockVersion?: number): Promise<WorldTickState> {
    await advanceSimulationTicks(this.prisma, ticks, { expectedLockVersion });
    return this.getTickState();
  }

  async reset(reseed: boolean): Promise<WorldTickState> {
    await resetSimulationData(this.prisma);

    if (reseed) {
      await seedWorld(this.prisma, { reset: false });
    }

    return this.getTickState();
  }

  async resetSimulationControlState() {
    const control = await this.prisma.simulationControlState.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        botsPaused: false,
        processingStopped: false,
        lastInvariantViolationTick: null,
        lastInvariantViolationAt: null
      },
      update: {
        botsPaused: false,
        processingStopped: false,
        lastInvariantViolationTick: null,
        lastInvariantViolationAt: null
      },
      select: {
        id: true,
        botsPaused: true,
        processingStopped: true,
        lastInvariantViolationTick: true,
        lastInvariantViolationAt: true,
        updatedAt: true
      }
    });

    return {
      id: control.id,
      botsPaused: control.botsPaused,
      processingStopped: control.processingStopped,
      lastInvariantViolationTick: control.lastInvariantViolationTick,
      lastInvariantViolationAt: control.lastInvariantViolationAt?.toISOString() ?? null,
      updatedAt: control.updatedAt.toISOString()
    };
  }
}


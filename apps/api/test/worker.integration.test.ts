import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seedWorld } from "../../../packages/db/src/seed-world";
import { createPrismaClient } from "../../../packages/db/src/client";
import { WorkerConfig } from "../../worker/src/config";
import { runWorkerIteration } from "../../worker/src/worker-loop";

describe("worker iteration integration", () => {
  let prisma: PrismaClient;

  const config: WorkerConfig = {
    tickIntervalMs: 60_000,
    simulationSpeed: 1,
    maxTicksPerRun: 10,
    invariantsCheckEveryTicks: 10,
    onInvariantViolation: "stop",
    botConfig: {
      enabled: true,
      botCount: 5,
      itemCodes: ["IRON_ORE", "IRON_INGOT", "HAND_TOOLS"],
      spreadBps: 500,
      maxNotionalPerTickCents: 50_000n
    }
  };

  beforeAll(() => {
    prisma = createPrismaClient();
  });

  beforeEach(async () => {
    await seedWorld(prisma, { reset: true });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("runs one worker iteration, places bot orders, and preserves invariants", async () => {
    const beforeTick = await prisma.worldTickState.findUniqueOrThrow({
      where: { id: 1 },
      select: { currentTick: true }
    });

    const result = await runWorkerIteration(prisma, config, {
      ticksOverride: 1,
      maxConflictRetries: 0
    });

    const afterTick = await prisma.worldTickState.findUniqueOrThrow({
      where: { id: 1 },
      select: { currentTick: true }
    });

    expect(result.tickBefore).toBe(beforeTick.currentTick);
    expect(result.tickAfter).toBe(beforeTick.currentTick + 1);
    expect(afterTick.currentTick).toBe(beforeTick.currentTick + 1);

    const createdBotOrders = await prisma.marketOrder.findMany({
      where: {
        tickPlaced: afterTick.currentTick,
        company: { isPlayer: false }
      },
      select: { id: true }
    });
    expect(createdBotOrders.length).toBeGreaterThan(0);

    const companies = await prisma.company.findMany({
      select: { cashCents: true, reservedCashCents: true }
    });
    expect(
      companies.every(
        (entry) =>
          entry.cashCents >= 0n &&
          entry.reservedCashCents >= 0n &&
          entry.reservedCashCents <= entry.cashCents
      )
    ).toBe(true);

    const inventories = await prisma.inventory.findMany({
      select: { quantity: true, reservedQuantity: true }
    });
    expect(
      inventories.every(
        (entry) =>
          entry.quantity >= 0 && entry.reservedQuantity >= 0 && entry.reservedQuantity <= entry.quantity
      )
    ).toBe(true);
  });

  it("starts at least one bot production job over several ticks", async () => {
    for (let i = 0; i < 6; i += 1) {
      await runWorkerIteration(prisma, config, {
        ticksOverride: 1,
        maxConflictRetries: 0
      });
    }

    const botProductionJobs = await prisma.productionJob.findMany({
      where: {
        company: { isPlayer: false }
      },
      select: {
        id: true
      }
    });

    expect(botProductionJobs.length).toBeGreaterThan(0);
  });
});

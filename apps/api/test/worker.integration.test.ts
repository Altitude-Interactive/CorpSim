import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seedWorld } from "@corpsim/db";
import { createPrismaClient } from "@corpsim/db";
import { WorkerConfig } from "../../worker/src/config";
import {
  acquireSimulationLease,
  releaseSimulationLease
} from "../../worker/src/simulation-lease";
import { runWorkerIteration } from "../../worker/src/worker-loop";

describe("worker iteration integration", () => {
  let prisma: PrismaClient;

  const config: WorkerConfig = {
    tickIntervalMs: 60_000,
    simulationSpeed: 1,
    maxTicksPerRun: 10,
    tickExecutionRetentionTicks: 100_000,
    tickExecutionCleanupEveryTicks: 100,
    invariantsCheckEveryTicks: 10,
    onInvariantViolation: "stop",
    botConfig: {
      enabled: true,
      botCount: 5,
      itemCodes: ["IRON_ORE", "IRON_INGOT", "HAND_TOOLS"],
      spreadBps: 500,
      maxNotionalPerTickCents: 50_000n
    },
    contractConfig: {
      contractsPerTick: 2,
      ttlTicks: 50,
      itemCodes: ["IRON_ORE", "IRON_INGOT", "HAND_TOOLS"],
      priceBandBps: 500
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

  it("creates open contracts over worker ticks", async () => {
    for (let i = 0; i < 3; i += 1) {
      await runWorkerIteration(prisma, config, {
        ticksOverride: 1,
        maxConflictRetries: 0
      });
    }

    const openContracts = await prisma.contract.count({
      where: {
        status: "OPEN"
      }
    });

    expect(openContracts).toBeGreaterThan(0);
  });

  it("treats duplicate execution keys as idempotent and avoids double advancement", async () => {
    const beforeTick = await prisma.worldTickState.findUniqueOrThrow({
      where: { id: 1 },
      select: { currentTick: true }
    });

    const first = await runWorkerIteration(prisma, config, {
      ticksOverride: 3,
      maxConflictRetries: 0,
      executionKey: "integration:duplicate-job"
    });
    const second = await runWorkerIteration(prisma, config, {
      ticksOverride: 3,
      maxConflictRetries: 0,
      executionKey: "integration:duplicate-job"
    });

    const afterTick = await prisma.worldTickState.findUniqueOrThrow({
      where: { id: 1 },
      select: { currentTick: true }
    });

    expect(first.ticksAdvanced).toBe(3);
    expect(second.ticksAdvanced).toBe(0);
    expect(afterTick.currentTick).toBe(beforeTick.currentTick + 3);
  });

  it("rejects iteration when a competing processor lease is already held", async () => {
    const leaseName = "integration:processor-lease";
    const ownerA = "integration-owner-a";
    const ownerB = "integration-owner-b";

    const acquired = await acquireSimulationLease(prisma, {
      name: leaseName,
      ownerId: ownerA,
      ttlMs: 120_000
    });
    expect(acquired).toBe(true);

    try {
      await expect(
        runWorkerIteration(prisma, config, {
          ticksOverride: 1,
          maxConflictRetries: 0,
          leaseName,
          leaseOwnerId: ownerB,
          leaseTtlMs: 120_000
        })
      ).rejects.toThrow("global simulation lease is currently held");
    } finally {
      await releaseSimulationLease(prisma, {
        name: leaseName,
        ownerId: ownerA
      });
    }
  });

  it("cleans up old tick execution rows based on retention policy", async () => {
    const cleanupConfig: WorkerConfig = {
      ...config,
      tickExecutionRetentionTicks: 2,
      tickExecutionCleanupEveryTicks: 1
    };

    for (let tick = 1; tick <= 5; tick += 1) {
      await runWorkerIteration(prisma, cleanupConfig, {
        ticksOverride: 1,
        maxConflictRetries: 0,
        executionKey: `integration:cleanup:${tick}`
      });
    }

    const rows = await prisma.simulationTickExecution.findMany({
      orderBy: { tickAfter: "asc" },
      select: { tickAfter: true }
    });

    expect(rows.map((entry) => entry.tickAfter)).toEqual([4, 5]);
  });
});


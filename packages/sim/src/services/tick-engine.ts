import { Prisma, PrismaClient } from "@prisma/client";
import { BotRuntimeConfig, runBotsForTick } from "../bots/bot-runner";
import { DomainInvariantError, OptimisticLockConflictError } from "../domain/errors";
import {
  ContractLifecycleConfig,
  runContractLifecycleForTick
} from "./contracts";
import { DemandSinkConfig, runDemandSinkForTick } from "./demand-sink";
import { upsertMarketCandlesForTick } from "./market-candles";
import { runMarketMatchingForTick } from "./market-matching";
import { completeDueProductionJobs } from "./production";
import { completeDueResearchJobs } from "./research";
import { deliverDueShipmentsForTick } from "./shipments";
import { runWorkforceForTick, WorkforceRuntimeConfig } from "./workforce";

interface WorldState {
  id: number;
  currentTick: number;
  lockVersion: number;
}

export interface AdvanceTickOptions {
  expectedLockVersion?: number;
  runBots?: boolean;
  botConfig?: Partial<BotRuntimeConfig>;
  demandConfig?: Partial<DemandSinkConfig>;
  contractConfig?: Partial<ContractLifecycleConfig>;
  workforceConfig?: Partial<WorkforceRuntimeConfig>;
}

export interface AdvanceSingleTickOptions extends AdvanceTickOptions {
  executionKey?: string;
}

export interface AdvanceSingleTickResult {
  tickBefore: number;
  tickAfter: number;
  advanced: boolean;
}

async function ensureWorldState(tx: Prisma.TransactionClient): Promise<WorldState> {
  const existing = await tx.worldTickState.findUnique({
    where: { id: 1 },
    select: { id: true, currentTick: true, lockVersion: true }
  });

  if (existing) {
    return existing;
  }

  const created = await tx.worldTickState.create({
    data: {
      id: 1,
      currentTick: 0,
      lockVersion: 0,
      lastAdvancedAt: null
    },
    select: { id: true, currentTick: true, lockVersion: true }
  });

  return created;
}

function validateExpectedLockVersion(expectedLockVersion: number | undefined): void {
  if (
    expectedLockVersion !== undefined &&
    (!Number.isInteger(expectedLockVersion) || expectedLockVersion < 0)
  ) {
    throw new DomainInvariantError("expectedLockVersion must be a non-negative integer");
  }
}

function normalizeExecutionKey(executionKey: string | undefined): string | undefined {
  if (executionKey === undefined) {
    return undefined;
  }

  const normalized = executionKey.trim();
  if (normalized.length === 0) {
    throw new DomainInvariantError("executionKey must be a non-empty string when provided");
  }

  return normalized;
}

function isTickExecutionConflict(error: unknown, executionKey: string | undefined): boolean {
  if (executionKey === undefined) {
    return false;
  }

  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (error.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target;
  if (typeof target === "string") {
    return target.includes("SimulationTickExecution") || target.includes("executionKey");
  }

  if (!Array.isArray(target)) {
    return false;
  }

  return target.some(
    (entry) =>
      typeof entry === "string" &&
      (entry.includes("SimulationTickExecution") || entry.includes("executionKey"))
  );
}

async function runTickPipeline(
  tx: Prisma.TransactionClient,
  nextTick: number,
  options: AdvanceSingleTickOptions
): Promise<void> {
  // Tick pipeline order:
  // 1) bot actions (orders / production starts)
  // 2) production completions
  // 3) research completions and recipe unlocks
  // 4) market matching and settlement
  // 5) shipment deliveries
  // 6) workforce update (scheduled arrivals, salary ledger, efficiency)
  // 7) baseline demand sink consumption
  // 8) contract lifecycle (expire and generate)
  // 9) market candle aggregation (OHLC/VWAP/volume)
  // 10) finalize world tick state
  if (options.runBots) {
    await runBotsForTick(tx, nextTick, options.botConfig);
  }

  await completeDueProductionJobs(tx, nextTick);
  await completeDueResearchJobs(tx, nextTick);
  // Matching runs in tick processing, not in request path.
  await runMarketMatchingForTick(tx, nextTick);
  await deliverDueShipmentsForTick(tx, nextTick);
  await runWorkforceForTick(tx, nextTick, options.workforceConfig);
  await runDemandSinkForTick(tx, nextTick, options.demandConfig);
  await runContractLifecycleForTick(tx, nextTick, options.contractConfig);
  await upsertMarketCandlesForTick(tx, nextTick);
}

export async function advanceSimulationTick(
  prisma: PrismaClient,
  options: AdvanceSingleTickOptions = {}
): Promise<AdvanceSingleTickResult> {
  validateExpectedLockVersion(options.expectedLockVersion);
  const executionKey = normalizeExecutionKey(options.executionKey);

  try {
    return await prisma.$transaction(async (tx) => {
      const world = await ensureWorldState(tx);

      if (options.expectedLockVersion !== undefined) {
        if (world.lockVersion !== options.expectedLockVersion) {
          throw new OptimisticLockConflictError(
            `expected lockVersion ${options.expectedLockVersion} but found ${world.lockVersion}`
          );
        }
      }

      if (executionKey) {
        const existingExecution = await tx.simulationTickExecution.findUnique({
          where: { executionKey },
          select: { executionKey: true }
        });
        if (existingExecution) {
          return {
            tickBefore: world.currentTick,
            tickAfter: world.currentTick,
            advanced: false
          };
        }

        await tx.simulationTickExecution.create({
          data: {
            executionKey,
            tickBefore: world.currentTick,
            tickAfter: world.currentTick
          }
        });
      }

      const nextTick = world.currentTick + 1;
      await runTickPipeline(tx, nextTick, options);

      const result = await tx.worldTickState.updateMany({
        where: {
          id: world.id,
          lockVersion: world.lockVersion
        },
        data: {
          currentTick: nextTick,
          lockVersion: { increment: 1 },
          lastAdvancedAt: new Date()
        }
      });

      if (result.count !== 1) {
        throw new OptimisticLockConflictError(
          "world tick state changed during tick advance; retry operation"
        );
      }

      if (executionKey) {
        await tx.simulationTickExecution.update({
          where: { executionKey },
          data: {
            tickBefore: world.currentTick,
            tickAfter: nextTick
          }
        });
      }

      return {
        tickBefore: world.currentTick,
        tickAfter: nextTick,
        advanced: true
      };
    });
  } catch (error: unknown) {
    if (!isTickExecutionConflict(error, executionKey)) {
      throw error;
    }

    const world = await getWorldTickState(prisma);
    const currentTick = world?.currentTick ?? 0;
    return {
      tickBefore: currentTick,
      tickAfter: currentTick,
      advanced: false
    };
  }
}

export async function advanceSimulationTicks(
  prisma: PrismaClient,
  ticks: number,
  options: AdvanceTickOptions = {}
): Promise<void> {
  if (!Number.isInteger(ticks) || ticks <= 0) {
    throw new DomainInvariantError("ticks must be a positive integer");
  }

  validateExpectedLockVersion(options.expectedLockVersion);

  for (let i = 0; i < ticks; i += 1) {
    await advanceSimulationTick(prisma, {
      expectedLockVersion: i === 0 ? options.expectedLockVersion : undefined,
      runBots: options.runBots,
      botConfig: options.botConfig,
      demandConfig: options.demandConfig,
      contractConfig: options.contractConfig,
      workforceConfig: options.workforceConfig
    });
  }
}

export async function getWorldTickState(prisma: PrismaClient) {
  return prisma.worldTickState.findUnique({
    where: { id: 1 },
    select: {
      id: true,
      currentTick: true,
      lockVersion: true,
      lastAdvancedAt: true
    }
  });
}

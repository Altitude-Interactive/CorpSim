import { PrismaClient } from "@prisma/client";
import {
  OptimisticLockConflictError,
  advanceSimulationTicks,
  getWorldTickState
} from "@corpsim/sim";
import { WorkerConfig } from "./config";

export interface RunWorkerIterationOptions {
  ticksOverride?: number;
  maxConflictRetries?: number;
  initialBackoffMs?: number;
  runBots?: boolean;
}

export interface WorkerIterationResult {
  ticksAdvanced: number;
  tickBefore: number;
  tickAfter: number;
  retries: number;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function resolveTickBatchSize(config: WorkerConfig, ticksOverride?: number): number {
  const requested = ticksOverride ?? config.simulationSpeed;
  const safeRequested = Number.isInteger(requested) && requested > 0 ? requested : 1;
  return Math.min(safeRequested, config.maxTicksPerRun);
}

export async function runWorkerIteration(
  prisma: PrismaClient,
  config: WorkerConfig,
  options: RunWorkerIterationOptions = {}
): Promise<WorkerIterationResult> {
  const ticks = resolveTickBatchSize(config, options.ticksOverride);
  const maxRetries = options.maxConflictRetries ?? 4;
  const initialBackoffMs = options.initialBackoffMs ?? 40;
  const runBots = options.runBots ?? true;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const before = await getWorldTickState(prisma);
      await advanceSimulationTicks(prisma, ticks, {
        runBots,
        botConfig: config.botConfig,
        contractConfig: config.contractConfig
      });
      const after = await getWorldTickState(prisma);

      return {
        ticksAdvanced: ticks,
        tickBefore: before?.currentTick ?? 0,
        tickAfter: after?.currentTick ?? 0,
        retries: attempt
      };
    } catch (error: unknown) {
      if (!(error instanceof OptimisticLockConflictError) || attempt >= maxRetries) {
        throw error;
      }

      const backoffMs = Math.min(500, initialBackoffMs * 2 ** attempt);
      await delay(backoffMs);
    }
  }

  throw new Error("worker iteration failed after conflict retries");
}



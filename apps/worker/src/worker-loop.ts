import { PrismaClient } from "@prisma/client";
import {
  OptimisticLockConflictError,
  advanceSimulationTick,
  getWorldTickState
} from "@corpsim/sim";
import { WorkerConfig } from "./config";
import { acquireSimulationLease, releaseSimulationLease } from "./simulation-lease";

export interface RunWorkerIterationOptions {
  ticksOverride?: number;
  maxConflictRetries?: number;
  initialBackoffMs?: number;
  runBots?: boolean;
  executionKey?: string;
  leaseName?: string;
  leaseOwnerId?: string;
  leaseTtlMs?: number;
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

interface RunSingleTickOptions {
  maxConflictRetries: number;
  initialBackoffMs: number;
  runBots: boolean;
  executionKey?: string;
  config: WorkerConfig;
}

interface RunSingleTickResult {
  advanced: boolean;
  retries: number;
}

async function runSingleTickWithRetries(
  prisma: PrismaClient,
  options: RunSingleTickOptions
): Promise<RunSingleTickResult> {
  for (let attempt = 0; attempt <= options.maxConflictRetries; attempt += 1) {
    try {
      const result = await advanceSimulationTick(prisma, {
        runBots: options.runBots,
        botConfig: options.config.botConfig,
        contractConfig: options.config.contractConfig,
        executionKey: options.executionKey
      });

      return {
        advanced: result.advanced,
        retries: attempt
      };
    } catch (error: unknown) {
      if (!(error instanceof OptimisticLockConflictError) || attempt >= options.maxConflictRetries) {
        throw error;
      }

      const backoffMs = Math.min(500, options.initialBackoffMs * 2 ** attempt);
      await delay(backoffMs);
    }
  }

  throw new Error("single tick advance failed after conflict retries");
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
  const leaseName = options.leaseName ?? "simulation.tick.processor";
  const leaseOwnerId = options.leaseOwnerId ?? `worker:${process.pid}`;
  const leaseTtlMs = options.leaseTtlMs ?? Math.max(120_000, config.tickIntervalMs * 2);

  const leaseAcquired = await acquireSimulationLease(prisma, {
    name: leaseName,
    ownerId: leaseOwnerId,
    ttlMs: leaseTtlMs
  });
  if (!leaseAcquired) {
    throw new Error(`global simulation lease is currently held (lease=${leaseName})`);
  }

  try {
    const before = await getWorldTickState(prisma);
    const tickBefore = before?.currentTick ?? 0;
    let ticksAdvanced = 0;
    let retries = 0;

    for (let tickIndex = 0; tickIndex < ticks; tickIndex += 1) {
      const executionKey =
        options.executionKey === undefined ? undefined : `${options.executionKey}:tick:${tickIndex}`;

      const tickResult = await runSingleTickWithRetries(prisma, {
        maxConflictRetries: maxRetries,
        initialBackoffMs,
        runBots,
        executionKey,
        config
      });
      if (tickResult.advanced) {
        ticksAdvanced += 1;
      }
      retries += tickResult.retries;
    }

    const after = await getWorldTickState(prisma);
    return {
      ticksAdvanced,
      tickBefore,
      tickAfter: after?.currentTick ?? tickBefore,
      retries
    };
  } finally {
    await releaseSimulationLease(prisma, {
      name: leaseName,
      ownerId: leaseOwnerId
    });
  }
}



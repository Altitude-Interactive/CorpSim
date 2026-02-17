/**
 * Worker Loop - Simulation Tick Processor
 *
 * @module worker/worker-loop
 *
 * ## Purpose
 * Core simulation advancement engine that executes one or more simulation ticks with
 * retry logic, maintenance pause handling, and lease-based concurrency control.
 *
 * ## Architecture Role
 * The workhorse of simulation processing:
 * - Processes individual ticks from queue or direct invocation
 * - Handles optimistic lock conflicts with exponential backoff
 * - Enforces maintenance windows (pauses between ticks if maintenance mode active)
 * - Cleans up old execution records for idempotency tracking
 *
 * ## Key Operations
 * ### Tick Processing
 * 1. Acquire simulation lease (prevents concurrent worker conflicts)
 * 2. Determine tick batch size (respects config and override)
 * 3. Execute ticks sequentially with retry logic
 * 4. Check maintenance status between ticks
 * 5. Release lease on completion or error
 * 6. Cleanup old execution records (retention policy)
 *
 * ### Retry Logic for Optimistic Lock Conflicts
 * - Catches `OptimisticLockConflictError` (concurrent modification detected)
 * - Exponential backoff: 50ms, 100ms, 200ms, 400ms (configurable)
 * - Default max retries: 4 attempts
 * - Throws on non-recoverable errors
 * - Tracks total retry count across batch
 *
 * ### Maintenance Pause Handling
 * - Checks maintenance status between each tick (configurable interval)
 * - If maintenance active, stops processing mid-batch (graceful pause)
 * - Returns partial progress (ticks advanced so far)
 * - Allows safe deployments without tick corruption
 *
 * ### Execution Row Cleanup
 * - Idempotency tracking uses `SimulationTickExecution` records
 * - Cleanup based on retention policy (e.g., keep last 1000 ticks)
 * - Runs conditionally (e.g., every 50 ticks) to reduce DB load
 * - Prevents unbounded table growth
 *
 * ## Configuration Options
 * - `ticksOverride`: Override default tick count for batch
 * - `maxConflictRetries`: Maximum retry attempts (default: 4)
 * - `initialBackoffMs`: Initial backoff delay (default: 50ms)
 * - `runBots`: Enable/disable bot execution for this batch
 * - `executionKey`: Optional idempotency key
 * - `leaseName/leaseOwnerId/leaseTtlMs`: Lease configuration
 *
 * ## Error Handling
 * - Exponential backoff on `OptimisticLockConflictError`
 * - Lease cleanup in finally block (always released)
 * - Maintenance checks prevent processing during service windows
 * - Non-recoverable errors propagate immediately
 *
 * ## Performance Considerations
 * - Batch size configurable (balance latency vs. throughput)
 * - Cleanup interval tunable (reduce DB overhead)
 * - Maintenance checks have configurable frequency
 * - Backoff prevents tight retry loops
 *
 * ## Use Cases
 * - Queue processor: Invoked by BullMQ for each scheduled job
 * - Once mode: Direct invocation for manual testing
 * - CI/Testing: Controlled tick advancement with known batch sizes
 */
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

function shouldCleanupTickExecutionRows(
  tickAfter: number,
  retentionTicks: number,
  cleanupEveryTicks: number
): boolean {
  if (retentionTicks <= 0) {
    return false;
  }

  if (cleanupEveryTicks <= 0) {
    return false;
  }

  if (!Number.isInteger(tickAfter) || tickAfter < 0) {
    return false;
  }

  return tickAfter % cleanupEveryTicks === 0;
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

async function isSimulationPausedByMaintenance(prisma: PrismaClient): Promise<boolean> {
  try {
    const state = await prisma.maintenanceState.findUnique({
      where: { id: 1 },
      select: {
        enabled: true,
        scope: true
      }
    });

    if (!state) {
      return false;
    }

    return state.enabled && state.scope === "all";
  } catch {
    return false;
  }
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
        demandConfig: options.config.demandConfig,
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

    if (await isSimulationPausedByMaintenance(prisma)) {
      return {
        ticksAdvanced: 0,
        tickBefore,
        tickAfter: tickBefore,
        retries: 0
      };
    }

    let ticksAdvanced = 0;
    let retries = 0;

    for (let tickIndex = 0; tickIndex < ticks; tickIndex += 1) {
      if (await isSimulationPausedByMaintenance(prisma)) {
        break;
      }

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
    const tickAfter = after?.currentTick ?? tickBefore;
    if (
      shouldCleanupTickExecutionRows(
        tickAfter,
        config.tickExecutionRetentionTicks,
        config.tickExecutionCleanupEveryTicks
      )
    ) {
      const minTickToKeep = Math.max(0, tickAfter - config.tickExecutionRetentionTicks + 1);
      await prisma.simulationTickExecution.deleteMany({
        where: {
          tickAfter: {
            lt: minTickToKeep
          }
        }
      });
    }

    return {
      ticksAdvanced,
      tickBefore,
      tickAfter,
      retries
    };
  } finally {
    await releaseSimulationLease(prisma, {
      name: leaseName,
      ownerId: leaseOwnerId
    });
  }
}



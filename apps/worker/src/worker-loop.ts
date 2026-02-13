import { PrismaClient } from "@prisma/client";
import {
  OptimisticLockConflictError,
  advanceSimulationTicks,
  getWorldTickState,
  scanSimulationInvariants
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

export interface WorkerLoopHandle {
  stop: () => Promise<void>;
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

function shouldRunInvariantCheck(
  previousTick: number,
  currentTick: number,
  everyTicks: number
): boolean {
  if (everyTicks <= 0 || currentTick <= previousTick) {
    return false;
  }

  return (
    Math.floor(previousTick / everyTicks) < Math.floor(currentTick / everyTicks) ||
    currentTick % everyTicks === 0
  );
}

export function startWorkerLoop(prisma: PrismaClient, config: WorkerConfig): WorkerLoopHandle {
  let stopped = false;
  let botsPaused = false;
  let timer: NodeJS.Timeout | undefined;
  let currentRun: Promise<void> | null = null;

  const scheduleNext = () => {
    if (stopped) {
      return;
    }

    timer = setTimeout(async () => {
      const runBots = !botsPaused;
      currentRun = runWorkerIteration(prisma, config, { runBots })
        .then((result) => {
          console.log(
            `[worker] ticks +${result.ticksAdvanced} (${result.tickBefore} -> ${result.tickAfter}) retries=${result.retries} bots=${runBots ? "on" : "paused"}`
          );

          if (
            shouldRunInvariantCheck(
              result.tickBefore,
              result.tickAfter,
              config.invariantsCheckEveryTicks
            )
          ) {
            return scanSimulationInvariants(prisma, 20).then((scan) => {
              if (!scan.hasViolations) {
                return;
              }

              const logPayload = {
                event: "simulation.invariant_violation",
                tick: result.tickAfter,
                policy: config.onInvariantViolation,
                issues: scan.issues
              };
              console.error("[worker] invariant violation detected", logPayload);

              if (config.onInvariantViolation === "pause_bots") {
                botsPaused = true;
                return;
              }

              if (config.onInvariantViolation === "stop") {
                stopped = true;
              }
            });
          }
        })
        .catch((error: unknown) => {
          console.error("[worker] iteration failed", error);
        })
        .finally(() => {
          currentRun = null;
          scheduleNext();
        });

      await currentRun;
    }, config.tickIntervalMs);
  };

  scheduleNext();

  return {
    stop: async () => {
      stopped = true;

      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }

      if (currentRun) {
        await currentRun;
      }
    }
  };
}


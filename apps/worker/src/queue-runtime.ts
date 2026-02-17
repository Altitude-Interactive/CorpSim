/**
 * Queue Runtime - BullMQ-Based Distributed Simulation Scheduler
 *
 * @module worker/queue-runtime
 *
 * ## Purpose
 * Sets up distributed queue infrastructure for tick scheduling and processing.
 * Enables horizontal scaling of simulation workers with lease-based role assignment
 * (scheduler vs. processor), invariant monitoring, and control policy enforcement.
 *
 * ## Architecture Role
 * Scheduling layer that:
 * - Distributes tick jobs across worker instances
 * - Enables horizontal scaling (multiple workers process queue concurrently)
 * - Provides reliable job scheduling with retry/backoff (via BullMQ)
 * - Monitors simulation health (invariant violations)
 * - Enforces control policies (pause bots, stop processing)
 *
 * ## Lease-Based Role Assignment
 * ### Scheduler Role (Single Instance)
 * - Acquires `simulation.tick.scheduler` lease
 * - Responsible for:
 *   - Adding repeatable tick jobs to queue
 *   - Renewing scheduler heartbeat (prevents takeover)
 * - If lease lost, another worker takes over scheduling
 * - Prevents duplicate job scheduling
 *
 * ### Processor Role (Multiple Instances)
 * - All workers (including scheduler) process jobs from queue
 * - Lease: `simulation.tick.processor` (per worker instance)
 * - Concurrent processing safe via optimistic locking in tick engine
 * - Handles job execution, retry on conflicts
 *
 * ## Job Processing Flow
 * 1. BullMQ schedules repeatable tick job (via scheduler)
 * 2. Worker picks up job from queue
 * 3. Checks control state (botsPaused, processingStopped)
 * 4. Executes `runWorkerIteration()` with idempotency key
 * 5. Runs invariant scan after successful tick
 * 6. Enforces policy if violations detected (pause bots or stop)
 * 7. Acknowledges job completion
 *
 * ## Invariant Monitoring
 * After each successful tick batch:
 * - Scans database for constraint violations
 * - Checks companies (cash, reservations, workforce)
 * - Checks inventory (quantities, reservations)
 * - On violations:
 *   - **pauseBotsOnInvariantViolation**: Disables bot execution (prevents cascade)
 *   - **stopOnInvariantViolation**: Stops all processing (critical failure)
 *
 * ## Control Policy Enforcement
 * - `botsPaused`: Bots don't execute, but other subsystems continue
 * - `processingStopped`: All tick processing halts (maintenance/emergency)
 * - Policies checked before each job execution
 * - Policies persisted in database (survives worker restarts)
 *
 * ## Configuration
 * - `queueName`: BullMQ queue identifier
 * - `schedulerIntervalMs`: How often to schedule tick jobs
 * - `schedulerLeaseRenewMs`: Heartbeat interval for scheduler lease
 * - `pauseBotsOnInvariantViolation`: Pause bots on violations (safety)
 * - `stopOnInvariantViolation`: Stop processing on violations (critical)
 * - `redis`: Connection settings (host, port, credentials)
 * - `bullmq`: Job options (attempts, backoff, removeOnComplete)
 *
 * ## Graceful Shutdown
 * - `stop()` closes queue and worker
 * - Waits for active jobs to complete
 * - Releases scheduler lease
 * - Allows safe deployment updates
 *
 * ## Error Handling
 * - Lease conflicts handled gracefully (falls back to processor-only)
 * - Job failures logged and retried per BullMQ config
 * - Scheduler heartbeat errors caught and logged
 * - Control state upsert is idempotent
 *
 * ## Use Cases
 * - Production: Continuous processing with multiple workers
 * - High availability: Scheduler failover via lease takeover
 * - Safety: Automatic pause/stop on invariant violations
 * - Scaling: Add/remove workers dynamically
 */
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { JobsOptions, Queue, Worker } from "bullmq";
import type { RedisOptions } from "ioredis";
import { scanSimulationInvariants } from "@corpsim/sim";
import { WorkerRuntimeConfig } from "./config";
import {
  ensureSimulationControlState,
  pauseBotsAfterInvariantViolation,
  stopSimulationAfterInvariantViolation
} from "./simulation-control";
import { acquireSimulationLease, releaseSimulationLease } from "./simulation-lease";
import { runWorkerIteration } from "./worker-loop";

interface TickJobData {
  ticksOverride?: number;
}

export interface QueueRuntimeHandle {
  stop: () => Promise<void>;
}

const PROCESSOR_LEASE_NAME = "simulation.tick.processor";
const SCHEDULER_LEASE_NAME = "simulation.tick.scheduler";

function buildWorkerInstanceId(config: WorkerRuntimeConfig): string {
  return `${config.bullmq.queueName}:${hostname()}:${process.pid}:${randomUUID()}`;
}

function resolveJobExecutionKey(
  config: WorkerRuntimeConfig,
  job: { id?: string | number | null; repeatJobKey?: string | null }
): string | undefined {
  const keyPart = job.id ?? job.repeatJobKey;
  if (keyPart === undefined || keyPart === null) {
    return undefined;
  }

  return `${config.bullmq.prefix}:${config.bullmq.queueName}:${String(keyPart)}`;
}

function buildRedisOptions(config: WorkerRuntimeConfig): RedisOptions {
  const redis = config.redis;

  return {
    host: redis.host,
    port: redis.port,
    db: redis.db,
    username: redis.username,
    password: redis.password,
    tls: redis.tlsEnabled ? {} : undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false
  };
}

function buildDefaultJobOptions(config: WorkerRuntimeConfig): JobsOptions {
  const options: JobsOptions = {
    attempts: config.bullmq.jobAttempts,
    removeOnComplete: config.bullmq.removeOnComplete,
    removeOnFail: config.bullmq.removeOnFail
  };

  if (config.bullmq.jobAttempts > 1 && config.bullmq.jobBackoffMs > 0) {
    options.backoff = {
      type: "fixed",
      delay: config.bullmq.jobBackoffMs
    };
  }

  return options;
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

async function ensureTickScheduler(queue: Queue<TickJobData>, config: WorkerRuntimeConfig): Promise<void> {
  const repeatOptions = {
    every: config.tickIntervalMs
  };

  const upsertJobScheduler = (
    queue as Queue<TickJobData> & {
      upsertJobScheduler?: (
        schedulerId: string,
        repeat: { every: number },
        template: { name: string; data: TickJobData }
      ) => Promise<unknown>;
    }
  ).upsertJobScheduler;

  if (typeof upsertJobScheduler === "function") {
    await upsertJobScheduler.call(queue, config.bullmq.schedulerId, repeatOptions, {
      name: config.bullmq.jobName,
      data: {}
    });

    return;
  }

  await queue.add(config.bullmq.jobName, {}, {
    jobId: config.bullmq.schedulerId,
    repeat: repeatOptions
  });
}

export async function startQueueRuntime(
  prisma: PrismaClient,
  config: WorkerRuntimeConfig
): Promise<QueueRuntimeHandle> {
  if (!config.bullmq.schedulerEnabled && !config.bullmq.workerEnabled) {
    throw new Error("Both BULLMQ_SCHEDULER_ENABLED and BULLMQ_WORKER_ENABLED are false");
  }

  const connection = buildRedisOptions(config);
  const queue = new Queue<TickJobData>(config.bullmq.queueName, {
    connection,
    prefix: config.bullmq.prefix,
    defaultJobOptions: buildDefaultJobOptions(config)
  });

  const workerInstanceId = buildWorkerInstanceId(config);
  const processorLeaseTtlMs = Math.max(config.tickIntervalMs * 2, 120_000);
  const schedulerLeaseTtlMs = Math.max(config.tickIntervalMs * 5, 300_000);
  let schedulerHeartbeat: NodeJS.Timeout | null = null;
  let schedulerLeaseHeld = false;

  await ensureSimulationControlState(prisma);

  if (config.bullmq.schedulerEnabled) {
    schedulerLeaseHeld = await acquireSimulationLease(prisma, {
      name: SCHEDULER_LEASE_NAME,
      ownerId: workerInstanceId,
      ttlMs: schedulerLeaseTtlMs
    }, { allowReentry: true });
    if (!schedulerLeaseHeld) {
      if (!config.bullmq.workerEnabled) {
        throw new Error("scheduler authority lease is held by another worker instance");
      }

      console.log(
        "[worker] scheduler lease is held by another instance; continuing in processor-only mode"
      );
    } else {
      schedulerHeartbeat = setInterval(() => {
        void acquireSimulationLease(prisma, {
          name: SCHEDULER_LEASE_NAME,
          ownerId: workerInstanceId,
          ttlMs: schedulerLeaseTtlMs
        }, { allowReentry: true }).catch((error: unknown) => {
          console.error("[worker] scheduler lease heartbeat failed", error);
        });
      }, Math.max(1_000, Math.floor(schedulerLeaseTtlMs / 2)));

      await ensureTickScheduler(queue, config);
      console.log(
        `[worker] scheduler enabled queue=${config.bullmq.queueName} every=${config.tickIntervalMs}ms`
      );
    }
  }

  let worker: Worker<TickJobData> | null = null;
  let shuttingDown = false;

  if (config.bullmq.workerEnabled) {
    worker = new Worker<TickJobData>(
      config.bullmq.queueName,
      async (job) => {
        if (shuttingDown) {
          return;
        }

        const controlState = await ensureSimulationControlState(prisma);
        if (controlState.processingStopped) {
          console.log("[worker] processing stopped by persisted control state");
          return;
        }

        const runBots = !controlState.botsPaused;
        const ticksOverride =
          typeof job.data.ticksOverride === "number" ? job.data.ticksOverride : undefined;
        const executionKey = resolveJobExecutionKey(config, {
          id: job.id,
          repeatJobKey: job.repeatJobKey
        });

        const result = await runWorkerIteration(prisma, config, {
          ticksOverride,
          runBots,
          executionKey,
          leaseName: PROCESSOR_LEASE_NAME,
          leaseOwnerId: workerInstanceId,
          leaseTtlMs: processorLeaseTtlMs
        });

        console.log(
          `[worker] ticks +${result.ticksAdvanced} (${result.tickBefore} -> ${result.tickAfter}) retries=${result.retries} bots=${runBots ? "on" : "paused"}`
        );

        if (
          !shouldRunInvariantCheck(
            result.tickBefore,
            result.tickAfter,
            config.invariantsCheckEveryTicks
          )
        ) {
          return;
        }

        const scan = await scanSimulationInvariants(prisma, 20);
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
          await pauseBotsAfterInvariantViolation(prisma, result.tickAfter);
          return;
        }

        if (config.onInvariantViolation === "stop") {
          await stopSimulationAfterInvariantViolation(prisma, result.tickAfter);
          await worker?.pause(true);
        }
      },
      {
        connection,
        prefix: config.bullmq.prefix,
        concurrency: config.bullmq.workerConcurrency
      }
    );

    worker.on("error", (error) => {
      console.error("[worker] bullmq worker error", error);
    });

    worker.on("failed", (job, error) => {
      console.error("[worker] bullmq job failed", {
        jobId: job?.id,
        jobName: job?.name,
        error: error?.message
      });
    });

    console.log(
      `[worker] processor enabled queue=${config.bullmq.queueName} concurrency=${config.bullmq.workerConcurrency}`
    );
  }

  return {
    stop: async () => {
      shuttingDown = true;

      if (schedulerHeartbeat) {
        clearInterval(schedulerHeartbeat);
      }

      if (worker) {
        await worker.close();
      }

      if (schedulerLeaseHeld) {
        await releaseSimulationLease(prisma, {
          name: SCHEDULER_LEASE_NAME,
          ownerId: workerInstanceId
        });
      }

      await queue.close();
    }
  };
}

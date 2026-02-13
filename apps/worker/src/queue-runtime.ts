import { PrismaClient } from "@prisma/client";
import { JobsOptions, Queue, Worker } from "bullmq";
import type { RedisOptions } from "ioredis";
import { scanSimulationInvariants } from "@corpsim/sim";
import { WorkerRuntimeConfig } from "./config";
import { runWorkerIteration } from "./worker-loop";

interface TickJobData {
  ticksOverride?: number;
}

export interface QueueRuntimeHandle {
  stop: () => Promise<void>;
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

  if (config.bullmq.schedulerEnabled) {
    await ensureTickScheduler(queue, config);
    console.log(
      `[worker] scheduler enabled queue=${config.bullmq.queueName} every=${config.tickIntervalMs}ms`
    );
  }

  let worker: Worker<TickJobData> | null = null;
  let stopped = false;
  let botsPaused = false;

  if (config.bullmq.workerEnabled) {
    worker = new Worker<TickJobData>(
      config.bullmq.queueName,
      async (job) => {
        if (stopped) {
          return;
        }

        const runBots = !botsPaused;
        const ticksOverride =
          typeof job.data.ticksOverride === "number" ? job.data.ticksOverride : undefined;

        const result = await runWorkerIteration(prisma, config, {
          ticksOverride,
          runBots
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
          botsPaused = true;
          return;
        }

        if (config.onInvariantViolation === "stop") {
          stopped = true;
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
      stopped = true;

      if (worker) {
        await worker.close();
      }

      await queue.close();
    }
  };
}

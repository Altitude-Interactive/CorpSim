import { BotRuntimeConfig, resolveBotRuntimeConfig } from "@corpsim/sim";
import {
  ContractLifecycleConfig,
  resolveContractLifecycleConfig
} from "@corpsim/sim";

export interface WorkerConfig {
  tickIntervalMs: number;
  simulationSpeed: number;
  maxTicksPerRun: number;
  invariantsCheckEveryTicks: number;
  onInvariantViolation: "stop" | "pause_bots" | "log_only";
  botConfig: Partial<BotRuntimeConfig>;
  contractConfig: Partial<ContractLifecycleConfig>;
}

export interface RedisConfig {
  host: string;
  port: number;
  db: number;
  username?: string;
  password?: string;
  tlsEnabled: boolean;
}

export interface BullMqConfig {
  prefix: string;
  queueName: string;
  schedulerId: string;
  jobName: string;
  schedulerEnabled: boolean;
  workerEnabled: boolean;
  workerConcurrency: number;
  jobAttempts: number;
  jobBackoffMs: number;
  removeOnComplete: number;
  removeOnFail: number;
}

export interface WorkerRuntimeConfig extends WorkerConfig {
  redis: RedisConfig;
  bullmq: BullMqConfig;
}

function parseIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

function parseNonNegativeIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }

  return parsed;
}

function parseBigIntEnv(name: string, fallback: bigint): bigint {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = BigInt(raw);
  if (parsed <= 0n) {
    throw new Error(`${name} must be greater than zero`);
  }

  return parsed;
}

function parseStringEnv(name: string, fallback: string): string {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const value = raw.trim();
  return value.length > 0 ? value : fallback;
}

function parseOptionalStringEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (!raw) {
    return undefined;
  }

  const value = raw.trim();
  return value.length > 0 ? value : undefined;
}

function parseBooleanEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") {
    return true;
  }
  if (normalized === "false" || normalized === "0") {
    return false;
  }

  throw new Error(`${name} must be true/false or 1/0`);
}

function parseItemCodes(raw: string | undefined): string[] | undefined {
  if (!raw) {
    return undefined;
  }

  const values = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return values.length > 0 ? values : undefined;
}

function parseInvariantPolicy(raw: string | undefined): "stop" | "pause_bots" | "log_only" {
  if (!raw) {
    return "stop";
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === "stop" || normalized === "pause_bots" || normalized === "log_only") {
    return normalized;
  }

  throw new Error("ON_INVARIANT_VIOLATION must be one of: stop, pause_bots, log_only");
}

export function loadWorkerConfig(): WorkerRuntimeConfig {
  const botConfig = resolveBotRuntimeConfig({
    enabled: parseBooleanEnv("BOT_ENABLED", true),
    botCount: parseIntegerEnv("BOT_COUNT", 25),
    itemCodes: parseItemCodes(process.env.BOT_ITEMS),
    spreadBps: parseIntegerEnv("BOT_SPREAD_BPS", 500),
    maxNotionalPerTickCents: parseBigIntEnv("BOT_MAX_NOTIONAL_PER_TICK_CENTS", 50_000n),
    producerCadenceTicks: parseIntegerEnv("BOT_PRODUCER_CADENCE_TICKS", 3),
    producerMinProfitBps: parseNonNegativeIntegerEnv("BOT_PRODUCER_MIN_PROFIT_BPS", 0)
  });
  const contractConfig = resolveContractLifecycleConfig({
    contractsPerTick: parseNonNegativeIntegerEnv("CONTRACTS_PER_TICK", 2),
    ttlTicks: parseIntegerEnv("CONTRACT_TTL_TICKS", 50),
    itemCodes: parseItemCodes(process.env.CONTRACT_ITEM_CODES),
    priceBandBps: parseNonNegativeIntegerEnv("CONTRACT_PRICE_BAND_BPS", 500)
  });

  const redis: RedisConfig = {
    host: parseStringEnv("REDIS_HOST", "localhost"),
    port: parseIntegerEnv("REDIS_PORT", 6379),
    db: parseNonNegativeIntegerEnv("REDIS_DB", 0),
    username: parseOptionalStringEnv("REDIS_USERNAME"),
    password: parseOptionalStringEnv("REDIS_PASSWORD"),
    tlsEnabled: parseBooleanEnv("REDIS_TLS", false)
  };

  const bullmq: BullMqConfig = {
    prefix: parseStringEnv("BULLMQ_PREFIX", "corpsim"),
    queueName: parseStringEnv("BULLMQ_QUEUE_NAME", "simulation.tick"),
    schedulerId: parseStringEnv("BULLMQ_SCHEDULER_ID", "simulation-tick-scheduler"),
    jobName: parseStringEnv("BULLMQ_JOB_NAME", "simulation.tick.process"),
    schedulerEnabled: parseBooleanEnv("BULLMQ_SCHEDULER_ENABLED", true),
    workerEnabled: parseBooleanEnv("BULLMQ_WORKER_ENABLED", true),
    workerConcurrency: parseIntegerEnv("BULLMQ_WORKER_CONCURRENCY", 1),
    jobAttempts: parseIntegerEnv("BULLMQ_JOB_ATTEMPTS", 1),
    jobBackoffMs: parseNonNegativeIntegerEnv("BULLMQ_JOB_BACKOFF_MS", 1000),
    removeOnComplete: parseNonNegativeIntegerEnv("BULLMQ_REMOVE_ON_COMPLETE", 500),
    removeOnFail: parseNonNegativeIntegerEnv("BULLMQ_REMOVE_ON_FAIL", 1000)
  };

  return {
    tickIntervalMs: parseIntegerEnv("TICK_INTERVAL_MS", 60_000),
    simulationSpeed: parseIntegerEnv("SIMULATION_SPEED", 1),
    maxTicksPerRun: parseIntegerEnv("MAX_TICKS_PER_RUN", 10),
    invariantsCheckEveryTicks: parseIntegerEnv("INVARIANTS_CHECK_EVERY_TICKS", 10),
    onInvariantViolation: parseInvariantPolicy(process.env.ON_INVARIANT_VIOLATION),
    botConfig,
    contractConfig,
    redis,
    bullmq
  };
}


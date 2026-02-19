/**
 * Tick Engine - Core Simulation Orchestration
 *
 * @module tick-engine
 *
 * ## Purpose
 * The tick engine is the authoritative orchestrator for advancing the discrete simulation state.
 * It coordinates a deterministic, transactional pipeline of subsystems (bots, production, market,
 * logistics, research, contracts) in a fixed, reproducible order.
 *
 * ## Deterministic Guarantees
 * - **Total ordering**: All tick operations execute in a strict, fixed sequence
 * - **ACID compliance**: Every tick runs within a single database transaction
 * - **Reproducibility**: Same input state + options → identical output state
 * - **Sequential incrementing**: currentTick always increments by exactly 1 per advance
 *
 * ## Invariants Enforced
 * - Lock version consistency via optimistic locking (detects concurrent modifications)
 * - Non-negative lockVersion validation on all inputs
 * - Idempotency via optional executionKey (same key cannot execute twice)
 * - All-or-nothing transaction semantics (no partial tick advances)
 *
 * ## Side Effects
 * All state mutations occur within a single transaction boundary:
 * - Bot actions (market orders, production starts)
 * - Building operating costs (deduct costs, deactivate buildings)
 * - Production/research completions
 * - Market trades and settlements
 * - Shipment deliveries
 * - Workforce updates (arrivals, salaries, efficiency)
 * - Demand consumption
 * - Contract lifecycle (expiration, generation)
 * - Market candle aggregation
 * - World state finalization (tick increment, lock version bump)
 *
 * ## Transaction Boundaries
 * - Single transaction wraps entire tick pipeline
 * - Rollback on any subsystem failure (preserves consistency)
 * - Optimistic locking prevents concurrent advances
 *
 * ## Data Flow
 * ```
 * Tick N → [Bots] → [Building Operating Costs] → [Production] → [Research] → [Market Matching]
 *        → [Shipments] → [Workforce] → [Demand] → [Contracts]
 *        → [Candles] → [World State Update] → Tick N+1
 * ```
 * Each stage reads state modified by previous stages; cascading updates within transaction.
 *
 * ## Concurrency Model
 * Uses optimistic locking to enable high concurrency without lock contention:
 * - lockVersion incremented on every successful advance
 * - Pre-execution check: lockVersion matches expected
 * - Post-execution validation: updateMany() with version condition
 * - Conflicts trigger OptimisticLockConflictError for client retry
 */
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
import { applyBuildingOperatingCostsWithTx } from "./buildings";

/**
 * Internal representation of world tick state for optimistic locking.
 */
interface WorldState {
  id: number;
  currentTick: number;
  lockVersion: number;
}

/**
 * Configuration options for advancing simulation ticks.
 *
 * @property expectedLockVersion - Optional optimistic lock version check (prevents concurrent advances)
 * @property runBots - Whether to execute bot strategies during the tick
 * @property botConfig - Bot runtime configuration overrides
 * @property demandConfig - Demand sink configuration overrides
 * @property contractConfig - Contract lifecycle configuration overrides
 * @property workforceConfig - Workforce system configuration overrides
 */
export interface AdvanceTickOptions {
  expectedLockVersion?: number;
  runBots?: boolean;
  botConfig?: Partial<BotRuntimeConfig>;
  demandConfig?: Partial<DemandSinkConfig>;
  contractConfig?: Partial<ContractLifecycleConfig>;
  workforceConfig?: Partial<WorkforceRuntimeConfig>;
}

/**
 * Options for advancing a single tick with idempotency support.
 *
 * @property executionKey - Optional unique key to ensure idempotent tick execution.
 *                          If provided, the same key cannot execute twice.
 */
export interface AdvanceSingleTickOptions extends AdvanceTickOptions {
  executionKey?: string;
}

/**
 * Result of a single tick advance operation.
 *
 * @property tickBefore - The tick number before the advance attempt
 * @property tickAfter - The tick number after the advance attempt
 * @property advanced - Whether the tick was actually advanced (false if idempotency check prevented re-execution)
 */
export interface AdvanceSingleTickResult {
  tickBefore: number;
  tickAfter: number;
  advanced: boolean;
}

/**
 * Ensures the world tick state record exists.
 *
 * @param tx - Prisma transaction client
 * @returns World state with current tick and lock version
 *
 * @remarks
 * Creates the singleton world state record if it doesn't exist (id=1).
 * This is safe to call concurrently - Prisma will handle race conditions.
 */
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

/**
 * Validates the expectedLockVersion parameter.
 *
 * @param expectedLockVersion - Lock version to validate
 * @throws {DomainInvariantError} If lock version is not a non-negative integer
 */
function validateExpectedLockVersion(expectedLockVersion: number | undefined): void {
  if (
    expectedLockVersion !== undefined &&
    (!Number.isInteger(expectedLockVersion) || expectedLockVersion < 0)
  ) {
    throw new DomainInvariantError("expectedLockVersion must be a non-negative integer");
  }
}

/**
 * Normalizes and validates the execution key for idempotency.
 *
 * @param executionKey - Execution key to normalize
 * @returns Trimmed execution key or undefined
 * @throws {DomainInvariantError} If execution key is provided but empty after trimming
 */
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

/**
 * Detects if an error is a unique constraint violation on the execution key.
 *
 * @param error - Error to check
 * @param executionKey - Execution key that was used
 * @returns True if error is an execution key conflict (idempotency check)
 *
 * @remarks
 * Used to distinguish between idempotency conflicts (graceful) and other errors (propagate).
 * Prisma error code P2002 indicates unique constraint violation.
 */
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

/**
 * Executes the deterministic tick pipeline in a fixed order.
 *
 * @param tx - Prisma transaction client
 * @param nextTick - The tick number being advanced to
 * @param options - Configuration options for subsystems
 *
 * @remarks
 * ## Pipeline Stages (Executed Sequentially)
 * 1. Bot actions (market orders, production starts)
 * 2. Building operating costs (deduct costs, deactivate unpaid buildings)
 * 3. Production job completions
 * 4. Research completions and recipe unlocks
 * 5. Market matching and settlement
 * 6. Shipment deliveries
 * 7. Workforce updates (arrivals, salaries, efficiency)
 * 8. Demand sink consumption (baseline market activity)
 * 9. Contract lifecycle (expiration and generation)
 * 10. Market candle aggregation (OHLC/VWAP/volume)
 *
 * ## Phase 3 Validations
 * - Storage capacity checked before inventory mutations (production, market, shipments)
 * - Building availability validated for production job creation
 *
 * ## Determinism
 * - Order is fixed and must not change (breaking change if reordered)
 * - Each stage reads state modified by previous stages
 * - All state mutations occur within the same transaction
 *
 * ## Error Handling
 * - Any stage failure causes full transaction rollback
 * - No partial tick advances are possible
 */
async function runTickPipeline(
  tx: Prisma.TransactionClient,
  nextTick: number,
  options: AdvanceSingleTickOptions
): Promise<void> {
  // Tick pipeline order:
  // 1) bot actions (orders / production starts)
  // 2) building operating costs (deactivate unpaid buildings)
  // 3) production completions
  // 4) research completions and recipe unlocks
  // 5) market matching and settlement
  // 6) shipment deliveries
  // 7) workforce update (scheduled arrivals, salary ledger, efficiency)
  // 8) baseline demand sink consumption
  // 9) contract lifecycle (expire and generate)
  // 10) market candle aggregation (OHLC/VWAP/volume)
  // 11) finalize world tick state
  //
  // Phase 3 Validations:
  // - Storage capacity checked before inventory mutations (production, market, shipments)
  // - Building availability validated for production job creation
  if (options.runBots) {
    await runBotsForTick(tx, nextTick, options.botConfig);
  }

  await applyBuildingOperatingCostsWithTx(tx, { tick: nextTick });
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

/**
 * Advances the simulation by exactly one tick.
 *
 * @param prisma - Prisma client for database access
 * @param options - Configuration options for the tick advance
 * @returns Result containing tick numbers and whether advance succeeded
 *
 * @throws {DomainInvariantError} If expectedLockVersion or executionKey validation fails
 * @throws {OptimisticLockConflictError} If concurrent modification detected
 *
 * @remarks
 * ## Transaction Guarantees
 * - Entire tick executes in a single database transaction
 * - All-or-nothing semantics (no partial advances)
 * - State is consistent before and after execution
 *
 * ## Optimistic Locking
 * - Checks expectedLockVersion if provided (prevents concurrent advances)
 * - Updates lockVersion atomically with updateMany + where clause
 * - Throws OptimisticLockConflictError if version mismatch detected
 *
 * ## Idempotency
 * - Optional executionKey prevents duplicate execution
 * - If executionKey already exists, returns {advanced: false} without error
 * - Execution record created within transaction (atomic with tick advance)
 *
 * ## Execution Flow
 * 1. Validate inputs (lock version, execution key)
 * 2. Start transaction
 * 3. Ensure world state exists
 * 4. Check optimistic lock version (if provided)
 * 5. Check/create execution record (if executionKey provided)
 * 6. Run tick pipeline (all subsystems)
 * 7. Update world state with optimistic lock check
 * 8. Update execution record with final tick
 * 9. Commit transaction
 *
 * ## Error Handling
 * - Validation errors propagate immediately (before transaction)
 * - Optimistic lock conflicts propagate for client retry
 * - Execution key conflicts return gracefully (idempotency)
 * - All other errors trigger transaction rollback
 */
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

/**
 * Advances the simulation by multiple ticks sequentially.
 *
 * @param prisma - Prisma client for database access
 * @param ticks - Number of ticks to advance (must be positive integer)
 * @param options - Configuration options applied to all ticks
 *
 * @throws {DomainInvariantError} If ticks is not a positive integer
 * @throws {OptimisticLockConflictError} If concurrent modification detected on any tick
 *
 * @remarks
 * ## Execution Behavior
 * - Executes ticks sequentially (not in parallel)
 * - Each tick is an independent transaction
 * - expectedLockVersion only checked on first tick (subsequent ticks have undefined lock version)
 * - Configuration (runBots, configs) applied to all ticks
 *
 * ## Failure Handling
 * - If any tick fails, remaining ticks are not executed
 * - Completed ticks remain committed (each is a separate transaction)
 * - Caller should handle partial completion (check world state after error)
 *
 * ## Use Cases
 * - Fast-forwarding simulation for testing
 * - Catching up after downtime
 * - Batch tick processing in worker loops
 */
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

/**
 * Retrieves the current world tick state.
 *
 * @param prisma - Prisma client for database access
 * @returns World state with current tick, lock version, and last advance timestamp (or null if not yet initialized)
 *
 * @remarks
 * - This is a read-only operation (no transaction required)
 * - Returns null if world state has never been initialized
 * - Use for monitoring, diagnostics, and lock version retrieval
 */
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

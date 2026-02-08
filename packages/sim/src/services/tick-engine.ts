import { Prisma, PrismaClient } from "@prisma/client";
import { BotRuntimeConfig, runBotsForTick } from "../bots/bot-runner";
import { DomainInvariantError, OptimisticLockConflictError } from "../domain/errors";
import {
  ContractLifecycleConfig,
  runContractLifecycleForTick
} from "./contracts";
import { upsertMarketCandlesForTick } from "./market-candles";
import { runMarketMatchingForTick } from "./market-matching";
import { completeDueProductionJobs } from "./production";
import { completeDueResearchJobs } from "./research";
import { deliverDueShipmentsForTick } from "./shipments";

interface WorldState {
  id: number;
  currentTick: number;
  lockVersion: number;
}

export interface AdvanceTickOptions {
  expectedLockVersion?: number;
  runBots?: boolean;
  botConfig?: Partial<BotRuntimeConfig>;
  contractConfig?: Partial<ContractLifecycleConfig>;
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

export async function advanceSimulationTicks(
  prisma: PrismaClient,
  ticks: number,
  options: AdvanceTickOptions = {}
): Promise<void> {
  if (!Number.isInteger(ticks) || ticks <= 0) {
    throw new DomainInvariantError("ticks must be a positive integer");
  }

  if (
    options.expectedLockVersion !== undefined &&
    (!Number.isInteger(options.expectedLockVersion) || options.expectedLockVersion < 0)
  ) {
    throw new DomainInvariantError("expectedLockVersion must be a non-negative integer");
  }

  for (let i = 0; i < ticks; i += 1) {
    await prisma.$transaction(async (tx) => {
      const world = await ensureWorldState(tx);

      if (i === 0 && options.expectedLockVersion !== undefined) {
        if (world.lockVersion !== options.expectedLockVersion) {
          throw new OptimisticLockConflictError(
            `expected lockVersion ${options.expectedLockVersion} but found ${world.lockVersion}`
          );
        }
      }

      const nextTick = world.currentTick + 1;

      // Tick pipeline order:
      // 1) bot actions (orders / production starts)
      // 2) production completions
      // 3) research completions and recipe unlocks
      // 4) market matching and settlement
      // 5) shipment deliveries
      // 6) contract lifecycle (expire and generate)
      // 7) market candle aggregation (OHLC/VWAP/volume)
      // 8) finalize world tick state
      if (options.runBots) {
        await runBotsForTick(tx, nextTick, options.botConfig);
      }

      await completeDueProductionJobs(tx, nextTick);
      await completeDueResearchJobs(tx, nextTick);
      // Matching runs in tick processing, not in request path.
      await runMarketMatchingForTick(tx, nextTick);
      await deliverDueShipmentsForTick(tx, nextTick);
      await runContractLifecycleForTick(tx, nextTick, options.contractConfig);
      await upsertMarketCandlesForTick(tx, nextTick);

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

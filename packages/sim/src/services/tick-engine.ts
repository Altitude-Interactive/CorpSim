import { Prisma, PrismaClient, ProductionJobStatus } from "@prisma/client";
import { DomainInvariantError, OptimisticLockConflictError } from "../domain/errors";
import { runMarketMatchingForTick } from "./market-matching";

interface WorldState {
  id: number;
  currentTick: number;
  lockVersion: number;
}

export interface AdvanceTickOptions {
  expectedLockVersion?: number;
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

async function completeDueProductionJobs(
  tx: Prisma.TransactionClient,
  nextTick: number
): Promise<void> {
  const jobs = await tx.productionJob.findMany({
    where: {
      status: ProductionJobStatus.IN_PROGRESS,
      dueTick: { lte: nextTick }
    },
    include: {
      recipe: {
        select: {
          outputItemId: true,
          outputQuantity: true
        }
      }
    }
  });

  for (const job of jobs) {
    const outputQuantity = job.recipe.outputQuantity * job.runs;

    await tx.inventory.upsert({
      where: {
        companyId_itemId: {
          companyId: job.companyId,
          itemId: job.recipe.outputItemId
        }
      },
      create: {
        companyId: job.companyId,
        itemId: job.recipe.outputItemId,
        quantity: outputQuantity,
        reservedQuantity: 0
      },
      update: {
        quantity: {
          increment: outputQuantity
        }
      }
    });

    await tx.productionJob.update({
      where: { id: job.id },
      data: {
        status: ProductionJobStatus.COMPLETED,
        completedTick: nextTick
      }
    });
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

      await completeDueProductionJobs(tx, nextTick);
      // Matching runs in tick processing, not in request path.
      await runMarketMatchingForTick(tx, nextTick);

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

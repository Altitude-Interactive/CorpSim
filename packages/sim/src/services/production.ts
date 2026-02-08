import { Prisma, ProductionJobStatus } from "@prisma/client";
import { DomainInvariantError } from "../domain/errors";

export interface StartProductionForCompanyInput {
  companyId: string;
  tick: number;
  maxJobs?: number;
}

export async function completeDueProductionJobs(
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

export async function startProductionForCompanyWithTx(
  tx: Prisma.TransactionClient,
  input: StartProductionForCompanyInput
): Promise<number> {
  const maxJobs = input.maxJobs ?? 1;

  if (!Number.isInteger(input.tick) || input.tick < 0) {
    throw new DomainInvariantError("tick must be a non-negative integer");
  }
  if (!Number.isInteger(maxJobs) || maxJobs <= 0) {
    throw new DomainInvariantError("maxJobs must be a positive integer");
  }

  const activeJobs = await tx.productionJob.count({
    where: {
      companyId: input.companyId,
      status: ProductionJobStatus.IN_PROGRESS
    }
  });

  if (activeJobs > 0) {
    return 0;
  }

  const recipes = await tx.recipe.findMany({
    orderBy: { code: "asc" },
    include: {
      inputs: {
        orderBy: { item: { code: "asc" } },
        include: {
          item: {
            select: { code: true }
          }
        }
      }
    }
  });

  if (recipes.length === 0) {
    return 0;
  }

  let started = 0;

  for (const recipe of recipes) {
    if (started >= maxJobs) {
      break;
    }

    const requiredItemIds = recipe.inputs.map((entry) => entry.itemId);
    if (requiredItemIds.length === 0) {
      continue;
    }

    const inventories = await tx.inventory.findMany({
      where: {
        companyId: input.companyId,
        itemId: { in: requiredItemIds }
      },
      select: {
        itemId: true,
        quantity: true,
        reservedQuantity: true
      }
    });

    const inventoryByItemId = new Map(inventories.map((entry) => [entry.itemId, entry]));

    let canStart = true;
    for (const ingredient of recipe.inputs) {
      const inventory = inventoryByItemId.get(ingredient.itemId);
      const available = (inventory?.quantity ?? 0) - (inventory?.reservedQuantity ?? 0);
      if (available < ingredient.quantity) {
        canStart = false;
        break;
      }
    }

    if (!canStart) {
      continue;
    }

    for (const ingredient of recipe.inputs) {
      await tx.inventory.update({
        where: {
          companyId_itemId: {
            companyId: input.companyId,
            itemId: ingredient.itemId
          }
        },
        data: {
          quantity: {
            decrement: ingredient.quantity
          }
        }
      });
    }

    await tx.productionJob.create({
      data: {
        companyId: input.companyId,
        recipeId: recipe.id,
        status: ProductionJobStatus.IN_PROGRESS,
        runs: 1,
        startedTick: input.tick,
        dueTick: input.tick + recipe.durationTicks
      }
    });

    started += 1;
  }

  return started;
}

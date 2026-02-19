/**
 * Production Lifecycle Service
 *
 * @module production
 *
 * ## Purpose
 * Manages the complete lifecycle of production jobs in a manufacturing simulation.
 * Handles creation, cancellation, and completion of manufacturing operations that
 * transform input items into outputs. Enforces recipe unlocking, specialization
 * constraints, and workforce modifiers.
 *
 * ## Production Job Lifecycle
 * 1. **Start**: `createProductionJob()` validates inputs, reserves inventory, checks recipe/specialization
 *    unlocks, calculates workforce-adjusted duration, creates IN_PROGRESS job
 * 2. **Completion**: `completeDueProductionJobs()` processes jobs when `currentTick >= dueTick`,
 *    consumes reserved inputs, produces outputs, marks status COMPLETED
 * 3. **Cancellation**: `cancelProductionJob()` releases reserved inputs, updates status to
 *    CANCELLED before execution
 * 4. **Profitable**: `startProfitableProductionForCompanyWithTx()` auto-starts recipes meeting
 *    profit thresholds
 *
 * ## Invariants Enforced
 * - **Input Atomicity**: Inventory reserved at job start; consumed only on completion (no partial execution)
 * - **Output Atomicity**: Output generated immediately upon job completion in single transaction
 * - **No Partial Completions**: Either entire job completes or fails; impossible to partially consume/produce
 * - **Reservation Consistency**: Reserved quantities tracked separately; available = quantity - reserved
 * - **Status Transitions**: Only IN_PROGRESS jobs can be cancelled/completed; prevents double-processing
 *
 * ## Resource Validation and Consumption
 * - **Availability Check**: `reserveInventoryForProduction()` validates sufficient free (non-reserved) inventory exists
 * - **Scaling**: `calculateRecipeInputRequirements()` multiplies recipe inputs by run count before reservation
 * - **Consumption Flow**: Reserve → (validate at completion) → Consume (decrement both quantity & reserved)
 * - **Output Upsert**: Creates or increments output inventory atomically
 *
 * ## Side Effects
 * All operations are transactional:
 * - Job creation: Reserves inventory, creates job record
 * - Job completion: Consumes inputs (decrements quantity and reservedQuantity), creates outputs,
 *   updates job status, creates ledger entries
 * - Job cancellation: Releases reserved inventory, updates job status
 *
 * ## Transaction Boundaries
 * - Each operation (start, complete, cancel) is a separate transaction
 * - Batch completion processes multiple jobs within the same transaction for efficiency
 * - Rollback on any validation failure or constraint violation
 *
 * ## Determinism
 * - Jobs complete at exact tick (dueTick)
 * - Completion order deterministic (sorted by dueTick, then id)
 * - Workforce modifiers applied consistently
 *
 * ## Error Handling
 * - NotFoundError: Entity (company, recipe, job) doesn't exist
 * - DomainInvariantError: Validation failures (insufficient inventory, locked recipes, negative values)
 * - Graceful fallback: `startProfitableProductionForCompanyWithTx()` skips unprofitable/unavailable
 *   recipes via try-catch
 * - All state changes are transactional; failures leave no partial state
 */
import {
  LedgerEntryType,
  Prisma,
  PrismaClient,
  ProductionJobStatus
} from "@prisma/client";
import {
  CompanySpecialization,
  normalizeCompanySpecialization,
  resolveIconItemFallbackPriceCents
} from "@corpsim/shared";
import {
  DomainInvariantError,
  NotFoundError
} from "../domain/errors";
import { availableCash } from "../domain/reservations";
import {
  isRecipeLockedBySpecialization,
  isRecipeLockedByIconTier,
  resolvePlayerUnlockedIconTierFromResearchCodes
} from "./item-tier-locker";
import {
  applyDurationMultiplierTicks,
  resolveWorkforceRuntimeModifiers
} from "./workforce";
import {
  validateProductionBuildingAvailable,
  validateStorageCapacity
} from "./buildings";

interface RecipeInputRow {
  itemId: string;
  quantity: number;
  item: {
    code: string;
  };
}

interface InventoryState {
  quantity: number;
  reservedQuantity: number;
}

export interface StartProductionJobInput {
  companyId: string;
  recipeId: string;
  quantity: number;
  tick?: number;
}

export interface CancelProductionJobInput {
  jobId: string;
  tick?: number;
}

export interface StartProfitableProductionForCompanyInput {
  companyId: string;
  tick: number;
  maxJobs?: number;
  referencePriceByItemId?: Map<string, bigint>;
  minProfitBps?: number;
}

export function isProductionJobDue(currentTick: number, dueTick: number): boolean {
  if (!Number.isInteger(currentTick) || currentTick < 0) {
    throw new DomainInvariantError("currentTick must be a non-negative integer");
  }
  if (!Number.isInteger(dueTick) || dueTick < 0) {
    throw new DomainInvariantError("dueTick must be a non-negative integer");
  }

  return currentTick >= dueTick;
}

export function reserveInventoryForProduction(
  inventory: InventoryState,
  quantityToReserve: number
): InventoryState {
  if (!Number.isInteger(quantityToReserve) || quantityToReserve <= 0) {
    throw new DomainInvariantError("quantityToReserve must be a positive integer");
  }
  if (inventory.quantity < 0 || inventory.reservedQuantity < 0) {
    throw new DomainInvariantError("inventory values cannot be negative");
  }

  const available = inventory.quantity - inventory.reservedQuantity;
  if (available < quantityToReserve) {
    throw new DomainInvariantError("insufficient input inventory for production");
  }

  return {
    quantity: inventory.quantity,
    reservedQuantity: inventory.reservedQuantity + quantityToReserve
  };
}

export function releaseReservedInventoryForProduction(
  inventory: InventoryState,
  quantityToRelease: number
): InventoryState {
  if (!Number.isInteger(quantityToRelease) || quantityToRelease <= 0) {
    throw new DomainInvariantError("quantityToRelease must be a positive integer");
  }
  if (inventory.quantity < 0 || inventory.reservedQuantity < 0) {
    throw new DomainInvariantError("inventory values cannot be negative");
  }
  if (inventory.reservedQuantity < quantityToRelease) {
    throw new DomainInvariantError("reserved inventory cannot become negative");
  }

  return {
    quantity: inventory.quantity,
    reservedQuantity: inventory.reservedQuantity - quantityToRelease
  };
}

export function consumeReservedInventoryForProduction(
  inventory: InventoryState,
  quantityToConsume: number
): InventoryState {
  if (!Number.isInteger(quantityToConsume) || quantityToConsume <= 0) {
    throw new DomainInvariantError("quantityToConsume must be a positive integer");
  }
  if (inventory.quantity < 0 || inventory.reservedQuantity < 0) {
    throw new DomainInvariantError("inventory values cannot be negative");
  }
  if (inventory.quantity < quantityToConsume) {
    throw new DomainInvariantError("inventory quantity cannot become negative");
  }
  if (inventory.reservedQuantity < quantityToConsume) {
    throw new DomainInvariantError("reserved inventory cannot become negative");
  }

  return {
    quantity: inventory.quantity - quantityToConsume,
    reservedQuantity: inventory.reservedQuantity - quantityToConsume
  };
}

export function calculateRecipeInputRequirements(
  inputs: Array<{ itemId: string; quantity: number }>,
  runs: number
): Array<{ itemId: string; quantity: number }> {
  if (!Number.isInteger(runs) || runs <= 0) {
    throw new DomainInvariantError("runs must be a positive integer");
  }

  return inputs.map((entry) => {
    if (!Number.isInteger(entry.quantity) || entry.quantity <= 0) {
      throw new DomainInvariantError("recipe input quantity must be a positive integer");
    }

    return {
      itemId: entry.itemId,
      quantity: entry.quantity * runs
    };
  });
}

function validateTick(tick: number, fieldName: string): void {
  if (!Number.isInteger(tick) || tick < 0) {
    throw new DomainInvariantError(`${fieldName} must be a non-negative integer`);
  }
}

function validateStartInput(input: StartProductionJobInput): void {
  if (!input.companyId) {
    throw new DomainInvariantError("companyId is required");
  }
  if (!input.recipeId) {
    throw new DomainInvariantError("recipeId is required");
  }
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new DomainInvariantError("quantity must be a positive integer");
  }
  if (input.tick !== undefined) {
    validateTick(input.tick, "tick");
  }
}

function validateCancelInput(input: CancelProductionJobInput): void {
  if (!input.jobId) {
    throw new DomainInvariantError("jobId is required");
  }
  if (input.tick !== undefined) {
    validateTick(input.tick, "tick");
  }
}

async function resolveTick(tx: Prisma.TransactionClient, explicitTick?: number): Promise<number> {
  if (explicitTick !== undefined) {
    return explicitTick;
  }

  const world = await tx.worldTickState.findUnique({
    where: { id: 1 },
    select: { currentTick: true }
  });

  return world?.currentTick ?? 0;
}

async function isLegacyCompanyRecipeState(
  tx: Prisma.TransactionClient,
  companyId: string
): Promise<boolean> {
  const [companyRecipeCount, totalRecipeCount] = await Promise.all([
    tx.companyRecipe.count({
      where: {
        companyId
      }
    }),
    tx.recipe.count()
  ]);

  return companyRecipeCount < totalRecipeCount;
}

function resolveFallbackItemPriceCents(itemCode: string): bigint {
  switch (itemCode) {
    case "IRON_ORE":
      return 80n;
    case "COAL":
      return 55n;
    case "COPPER_ORE":
      return 95n;
    case "IRON_INGOT":
      return 200n;
    case "COPPER_INGOT":
      return 245n;
    case "HAND_TOOLS":
      return 350n;
    case "STEEL_INGOT":
      return 430n;
    case "STEEL_BEAM":
      return 940n;
    case "FASTENERS":
      return 150n;
    case "MACHINE_PARTS":
      return 1_250n;
    case "TOOL_KIT":
      return 2_100n;
    case "POWER_UNIT":
      return 2_550n;
    case "CONVEYOR_MODULE":
      return 4_250n;
    case "INDUSTRIAL_PRESS":
      return 11_500n;
    case "SYNTHETIC_CONDUIT":
      return 520n;
    case "BIOCELL_CANISTER":
      return 780n;
    case "SERVO_DRIVE":
      return 1_450n;
    case "OPTIC_MODULE":
      return 1_820n;
    case "NEURAL_INTERFACE":
      return 3_600n;
    case "SPINAL_LINK":
      return 7_600n;
    case "OCULAR_IMPLANT":
      return 8_200n;
    case "CYBER_ARMATURE":
      return 9_400n;
    case "CYBERNETIC_SUITE":
      return 24_000n;
    default:
      return resolveIconItemFallbackPriceCents(itemCode) ?? 100n;
  }
}

function resolveItemPriceCents(
  itemId: string,
  itemCode: string,
  referencePriceByItemId: Map<string, bigint> | undefined
): bigint {
  const fromMarket = referencePriceByItemId?.get(itemId);
  if (fromMarket !== undefined) {
    return fromMarket;
  }

  return resolveFallbackItemPriceCents(itemCode);
}

function isRecipeProfitable(
  recipe: {
    outputQuantity: number;
    outputItem: { id: string; code: string };
    inputs: RecipeInputRow[];
  },
  referencePriceByItemId: Map<string, bigint> | undefined,
  minProfitBps: number
): boolean {
  const outputValueCents =
    BigInt(recipe.outputQuantity) *
    resolveItemPriceCents(
      recipe.outputItem.id,
      recipe.outputItem.code,
      referencePriceByItemId
    );

  let totalInputCostCents = 0n;
  for (const input of recipe.inputs) {
    totalInputCostCents +=
      BigInt(input.quantity) *
      resolveItemPriceCents(input.itemId, input.item.code, referencePriceByItemId);
  }

  if (totalInputCostCents <= 0n) {
    return outputValueCents > 0n;
  }

  return (
    outputValueCents * 10_000n >
    totalInputCostCents * BigInt(10_000 + minProfitBps)
  );
}

export async function createProductionJob(
  prisma: PrismaClient,
  input: StartProductionJobInput
) {
  validateStartInput(input);

  return prisma.$transaction(async (tx) => {
    return createProductionJobWithTx(tx, input);
  });
}

export async function createProductionJobWithTx(
  tx: Prisma.TransactionClient,
  input: StartProductionJobInput
) {
  validateStartInput(input);

  const tick = await resolveTick(tx, input.tick);

  const [company, recipe, companyRecipe] = await Promise.all([
    tx.company.findUnique({
      where: { id: input.companyId },
      select: {
        id: true,
        isPlayer: true,
        specialization: true,
        regionId: true,
        workforceCapacity: true,
        workforceAllocationOpsPct: true,
        workforceAllocationRngPct: true,
        workforceAllocationLogPct: true,
        workforceAllocationCorpPct: true,
        orgEfficiencyBps: true
      }
    }),
    tx.recipe.findUnique({
      where: { id: input.recipeId },
      include: {
        outputItem: {
          select: {
            id: true,
            code: true,
            name: true
          }
        },
        inputs: {
          orderBy: { item: { code: "asc" } },
          include: {
            item: {
              select: {
                id: true,
                code: true,
                name: true
              }
            }
          }
        }
      }
    }),
    tx.companyRecipe.findUnique({
      where: {
        companyId_recipeId: {
          companyId: input.companyId,
          recipeId: input.recipeId
        }
      },
      select: {
        isUnlocked: true
      }
    })
  ]);

  if (!company) {
    throw new NotFoundError(`company ${input.companyId} not found`);
  }
  if (!recipe) {
    throw new NotFoundError(`recipe ${input.recipeId} not found`);
  }
  if (company.isPlayer) {
    const completedResearchRows = await tx.companyResearch.findMany({
      where: {
        companyId: input.companyId,
        status: "COMPLETED"
      },
      select: {
        node: {
          select: {
            code: true
          }
        }
      }
    });
    const unlockedIconTier = resolvePlayerUnlockedIconTierFromResearchCodes(
      completedResearchRows.map((row) => row.node.code)
    );
    if (isRecipeLockedByIconTier(recipe, unlockedIconTier)) {
      throw new DomainInvariantError(
        `recipe ${input.recipeId} is not unlocked for company ${input.companyId}`
      );
    }
    if (
      isRecipeLockedBySpecialization(
        recipe,
        normalizeCompanySpecialization(company.specialization as CompanySpecialization)
      )
    ) {
      throw new DomainInvariantError(
        `recipe ${input.recipeId} is not available for company specialization`
      );
    }
  }
  if (!companyRecipe?.isUnlocked && !(await isLegacyCompanyRecipeState(tx, input.companyId))) {
    throw new DomainInvariantError(`recipe ${input.recipeId} is not unlocked for company ${input.companyId}`);
  }
  if (recipe.durationTicks < 0) {
    throw new DomainInvariantError("recipe durationTicks cannot be negative");
  }

  // Validate player company has at least one active production building
  // (bots operate with different rules and may not have buildings)
  if (company.isPlayer) {
    await validateProductionBuildingAvailable(tx, input.companyId);
  }

  const requirements = calculateRecipeInputRequirements(recipe.inputs, input.quantity);
  const requiredItemIds = requirements.map((entry) => entry.itemId);

  const inventoryRows =
    requiredItemIds.length === 0
      ? []
      : await tx.inventory.findMany({
          where: {
            companyId: input.companyId,
            itemId: { in: requiredItemIds },
            regionId: company.regionId
          },
          select: {
            companyId: true,
            itemId: true,
            regionId: true,
            quantity: true,
            reservedQuantity: true
          }
        });

  const inventoryByItemId = new Map(inventoryRows.map((entry) => [entry.itemId, entry]));

  for (const requirement of requirements) {
    const inventory = inventoryByItemId.get(requirement.itemId);
    if (!inventory) {
      throw new DomainInvariantError(
        `insufficient input inventory for item ${requirement.itemId}`
      );
    }

    reserveInventoryForProduction(
      {
        quantity: inventory.quantity,
        reservedQuantity: inventory.reservedQuantity
      },
      requirement.quantity
    );
  }

  for (const requirement of requirements) {
    await tx.inventory.update({
      where: {
        companyId_itemId_regionId: {
          companyId: input.companyId,
          itemId: requirement.itemId,
          regionId: company.regionId
        }
      },
      data: {
        reservedQuantity: {
          increment: requirement.quantity
        }
      }
    });
  }

  const workforceModifiers = resolveWorkforceRuntimeModifiers({
    workforceCapacity: company.workforceCapacity,
    workforceAllocationOpsPct: company.workforceAllocationOpsPct,
    workforceAllocationRngPct: company.workforceAllocationRngPct,
    workforceAllocationLogPct: company.workforceAllocationLogPct,
    workforceAllocationCorpPct: company.workforceAllocationCorpPct,
    orgEfficiencyBps: company.orgEfficiencyBps
  });
  const adjustedDurationTicks = applyDurationMultiplierTicks(
    recipe.durationTicks,
    workforceModifiers.productionDurationMultiplierBps
  );

  return tx.productionJob.create({
    data: {
      companyId: input.companyId,
      recipeId: input.recipeId,
      status: ProductionJobStatus.IN_PROGRESS,
      runs: input.quantity,
      startedTick: tick,
      dueTick: tick + adjustedDurationTicks
    },
    include: {
      company: {
        select: {
          id: true,
          regionId: true
        }
      },
      recipe: {
        include: {
          outputItem: {
            select: {
              id: true,
              code: true,
              name: true
            }
          },
          inputs: {
            orderBy: { item: { code: "asc" } },
            include: {
              item: {
                select: {
                  id: true,
                  code: true,
                  name: true
                }
              }
            }
          }
        }
      }
    }
  });
}

export async function cancelProductionJob(
  prisma: PrismaClient,
  input: CancelProductionJobInput
) {
  validateCancelInput(input);

  return prisma.$transaction(async (tx) => {
    return cancelProductionJobWithTx(tx, input);
  });
}

export async function cancelProductionJobWithTx(
  tx: Prisma.TransactionClient,
  input: CancelProductionJobInput
) {
  validateCancelInput(input);

  const tick = await resolveTick(tx, input.tick);
  const job = await tx.productionJob.findUnique({
    where: { id: input.jobId },
    include: {
      company: {
        select: {
          id: true,
          regionId: true
        }
      },
      recipe: {
        include: {
          outputItem: {
            select: {
              id: true,
              code: true,
              name: true
            }
          },
          inputs: {
            orderBy: { item: { code: "asc" } },
            include: {
              item: {
                select: {
                  id: true,
                  code: true,
                  name: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!job) {
    throw new NotFoundError(`production job ${input.jobId} not found`);
  }

  if (job.status !== ProductionJobStatus.IN_PROGRESS) {
    return job;
  }

  const requirements = calculateRecipeInputRequirements(job.recipe.inputs, job.runs);
  const inventories =
    requirements.length === 0
      ? []
      : await tx.inventory.findMany({
          where: {
            companyId: job.companyId,
            itemId: { in: requirements.map((entry) => entry.itemId) },
            regionId: job.company.regionId
          },
          select: {
            companyId: true,
            itemId: true,
            regionId: true,
            quantity: true,
            reservedQuantity: true
          }
        });

  const inventoryByItemId = new Map(inventories.map((entry) => [entry.itemId, entry]));

  for (const requirement of requirements) {
    const inventory = inventoryByItemId.get(requirement.itemId);
    if (!inventory) {
      throw new DomainInvariantError(
        `reserved inventory row missing for item ${requirement.itemId}`
      );
    }

    releaseReservedInventoryForProduction(
      {
        quantity: inventory.quantity,
        reservedQuantity: inventory.reservedQuantity
      },
      requirement.quantity
    );
  }

  for (const requirement of requirements) {
    await tx.inventory.update({
      where: {
        companyId_itemId_regionId: {
          companyId: job.companyId,
          itemId: requirement.itemId,
          regionId: job.company.regionId
        }
      },
      data: {
        reservedQuantity: {
          decrement: requirement.quantity
        }
      }
    });
  }

  return tx.productionJob.update({
    where: { id: job.id },
    data: {
      status: ProductionJobStatus.CANCELLED,
      completedTick: tick
    },
    include: {
      company: {
        select: {
          id: true,
          regionId: true
        }
      },
      recipe: {
        include: {
          outputItem: {
            select: {
              id: true,
              code: true,
              name: true
            }
          },
          inputs: {
            orderBy: { item: { code: "asc" } },
            include: {
              item: {
                select: {
                  id: true,
                  code: true,
                  name: true
                }
              }
            }
          }
        }
      }
    }
  });
}

export async function completeDueProductionJobs(
  tx: Prisma.TransactionClient,
  nextTick: number
): Promise<void> {
  validateTick(nextTick, "nextTick");

  const dueJobs = await tx.productionJob.findMany({
    where: {
      status: ProductionJobStatus.IN_PROGRESS,
      dueTick: { lte: nextTick }
    },
    orderBy: [{ dueTick: "asc" }, { createdAt: "asc" }],
    include: {
      company: {
        select: {
          id: true,
          regionId: true
        }
      },
      recipe: {
        include: {
          outputItem: {
            select: {
              id: true,
              code: true,
              name: true
            }
          },
          inputs: {
            orderBy: { item: { code: "asc" } },
            include: {
              item: {
                select: {
                  id: true,
                  code: true,
                  name: true
                }
              }
            }
          }
        }
      }
    }
  });

  for (const job of dueJobs) {
    if (!isProductionJobDue(nextTick, job.dueTick)) {
      continue;
    }

    const requirements = calculateRecipeInputRequirements(job.recipe.inputs, job.runs);
    const inventories =
      requirements.length === 0
        ? []
        : await tx.inventory.findMany({
            where: {
              companyId: job.companyId,
              itemId: { in: requirements.map((entry) => entry.itemId) },
              regionId: job.company.regionId
            },
            select: {
              companyId: true,
              itemId: true,
              regionId: true,
              quantity: true,
              reservedQuantity: true
            }
          });

    const inventoryByItemId = new Map(inventories.map((entry) => [entry.itemId, entry]));

    for (const requirement of requirements) {
      const inventory = inventoryByItemId.get(requirement.itemId);
      if (!inventory) {
        throw new DomainInvariantError(
          `reserved inventory row missing for item ${requirement.itemId}`
        );
      }

      consumeReservedInventoryForProduction(
        {
          quantity: inventory.quantity,
          reservedQuantity: inventory.reservedQuantity
        },
        requirement.quantity
      );
    }

    const outputQuantity = job.recipe.outputQuantity * job.runs;

    // Validate storage capacity BEFORE any inventory mutations
    await validateStorageCapacity(
      tx,
      job.companyId,
      job.company.regionId,
      outputQuantity
    );

    for (const requirement of requirements) {
      await tx.inventory.update({
        where: {
          companyId_itemId_regionId: {
            companyId: job.companyId,
            itemId: requirement.itemId,
            regionId: job.company.regionId
          }
        },
        data: {
          quantity: {
            decrement: requirement.quantity
          },
          reservedQuantity: {
            decrement: requirement.quantity
          }
        }
      });
    }

    await tx.inventory.upsert({
      where: {
        companyId_itemId_regionId: {
          companyId: job.companyId,
          itemId: job.recipe.outputItemId,
          regionId: job.company.regionId
        }
      },
      create: {
        companyId: job.companyId,
        itemId: job.recipe.outputItemId,
        regionId: job.company.regionId,
        quantity: outputQuantity,
        reservedQuantity: 0
      },
      update: {
        quantity: {
          increment: outputQuantity
        }
      }
    });

    const company = await tx.company.findUnique({
      where: { id: job.companyId },
      select: {
        id: true,
        cashCents: true
      }
    });

    if (!company) {
      throw new NotFoundError(`company ${job.companyId} not found`);
    }

    await tx.productionJob.update({
      where: { id: job.id },
      data: {
        status: ProductionJobStatus.COMPLETED,
        completedTick: nextTick
      }
    });

    await tx.ledgerEntry.create({
      data: {
        companyId: company.id,
        tick: nextTick,
        entryType: LedgerEntryType.PRODUCTION_COMPLETION,
        deltaCashCents: 0n,
        deltaReservedCashCents: 0n,
        balanceAfterCents: company.cashCents,
        referenceType: "PRODUCTION_JOB_COMPLETION",
        referenceId: job.id
      }
    });
  }
}

export async function startProfitableProductionForCompanyWithTx(
  tx: Prisma.TransactionClient,
  input: StartProfitableProductionForCompanyInput
): Promise<number> {
  const maxJobs = input.maxJobs ?? 1;
  const minProfitBps = input.minProfitBps ?? 0;

  validateTick(input.tick, "tick");
  if (!Number.isInteger(maxJobs) || maxJobs <= 0) {
    throw new DomainInvariantError("maxJobs must be a positive integer");
  }
  if (!Number.isInteger(minProfitBps) || minProfitBps < 0) {
    throw new DomainInvariantError("minProfitBps must be a non-negative integer");
  }

  const company = await tx.company.findUnique({
    where: { id: input.companyId },
    select: {
      id: true,
      cashCents: true,
      reservedCashCents: true
    }
  });

  if (!company) {
    throw new NotFoundError(`company ${input.companyId} not found`);
  }

  if (
    availableCash({
      cashCents: company.cashCents,
      reservedCashCents: company.reservedCashCents
    }) <= 0n
  ) {
    return 0;
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
      outputItem: {
        select: {
          id: true,
          code: true
        }
      },
      inputs: {
        orderBy: { item: { code: "asc" } },
        include: {
          item: {
            select: {
              code: true
            }
          }
        }
      }
    }
  });

  let startedJobs = 0;

  for (const recipe of recipes) {
    if (startedJobs >= maxJobs) {
      break;
    }

    if (
      !isRecipeProfitable(recipe, input.referencePriceByItemId, minProfitBps)
    ) {
      continue;
    }

    try {
      await createProductionJobWithTx(tx, {
        companyId: input.companyId,
        recipeId: recipe.id,
        quantity: 1,
        tick: input.tick
      });
      startedJobs += 1;
    } catch (error: unknown) {
      if (error instanceof DomainInvariantError) {
        continue;
      }
      throw error;
    }
  }

  return startedJobs;
}

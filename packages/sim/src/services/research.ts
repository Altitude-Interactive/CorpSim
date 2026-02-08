import {
  CompanyResearchStatus,
  LedgerEntryType,
  Prisma,
  PrismaClient,
  ResearchJobStatus
} from "@prisma/client";
import { DomainInvariantError, NotFoundError } from "../domain/errors";

export interface ListResearchForCompanyInput {
  companyId: string;
}

export interface StartResearchInput {
  companyId: string;
  nodeId: string;
  tick?: number;
}

export interface CancelResearchInput {
  companyId: string;
  nodeId: string;
  tick?: number;
}

function validateCompanyId(companyId: string): void {
  if (!companyId) {
    throw new DomainInvariantError("companyId is required");
  }
}

function validateNodeId(nodeId: string): void {
  if (!nodeId) {
    throw new DomainInvariantError("nodeId is required");
  }
}

function validateTick(tick: number, fieldName: string): void {
  if (!Number.isInteger(tick) || tick < 0) {
    throw new DomainInvariantError(`${fieldName} must be a non-negative integer`);
  }
}

async function resolveTick(tx: Prisma.TransactionClient, explicitTick?: number): Promise<number> {
  if (explicitTick !== undefined) {
    validateTick(explicitTick, "tick");
    return explicitTick;
  }

  const world = await tx.worldTickState.findUnique({
    where: { id: 1 },
    select: { currentTick: true }
  });

  return world?.currentTick ?? 0;
}

async function assertResearchableCompany(
  tx: Prisma.TransactionClient,
  companyId: string
): Promise<{
  id: string;
  cashCents: bigint;
}> {
  const company = await tx.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      isPlayer: true,
      ownerPlayerId: true,
      cashCents: true
    }
  });

  if (!company) {
    throw new NotFoundError(`company ${companyId} not found`);
  }
  if (!company.isPlayer || company.ownerPlayerId === null) {
    throw new DomainInvariantError("only player-owned companies can research");
  }

  return {
    id: company.id,
    cashCents: company.cashCents
  };
}

async function getCompletedPrerequisiteSet(
  tx: Prisma.TransactionClient,
  companyId: string
): Promise<Set<string>> {
  const completedRows = await tx.companyResearch.findMany({
    where: {
      companyId,
      status: CompanyResearchStatus.COMPLETED
    },
    select: {
      nodeId: true
    }
  });

  return new Set(completedRows.map((row) => row.nodeId));
}

export async function listResearchForCompany(
  prisma: PrismaClient,
  input: ListResearchForCompanyInput
) {
  validateCompanyId(input.companyId);

  const [company, nodes, companyResearchRows, runningJobs] = await Promise.all([
    prisma.company.findUnique({
      where: { id: input.companyId },
      select: {
        id: true,
        isPlayer: true,
        ownerPlayerId: true
      }
    }),
    prisma.researchNode.findMany({
      orderBy: { code: "asc" },
      include: {
        prerequisites: {
          select: {
            prerequisiteNodeId: true
          }
        },
        unlockRecipes: {
          include: {
            recipe: {
              select: {
                id: true,
                code: true,
                name: true
              }
            }
          },
          orderBy: {
            recipe: {
              code: "asc"
            }
          }
        }
      }
    }),
    prisma.companyResearch.findMany({
      where: {
        companyId: input.companyId
      },
      select: {
        nodeId: true,
        status: true,
        tickStarted: true,
        tickCompletes: true
      }
    }),
    prisma.researchJob.findMany({
      where: {
        companyId: input.companyId,
        status: ResearchJobStatus.RUNNING
      },
      select: {
        nodeId: true,
        tickStarted: true,
        tickCompletes: true
      }
    })
  ]);

  if (!company) {
    throw new NotFoundError(`company ${input.companyId} not found`);
  }
  if (!company.isPlayer || company.ownerPlayerId === null) {
    throw new DomainInvariantError("only player-owned companies can research");
  }

  const companyResearchByNodeId = new Map(
    companyResearchRows.map((row) => [row.nodeId, row] as const)
  );
  const runningJobsByNodeId = new Map(
    runningJobs.map((job) => [job.nodeId, job] as const)
  );
  const completedNodeIds = new Set(
    companyResearchRows
      .filter((row) => row.status === CompanyResearchStatus.COMPLETED)
      .map((row) => row.nodeId)
  );

  return nodes.map((node) => {
    const row = companyResearchByNodeId.get(node.id);
    const runningJob = runningJobsByNodeId.get(node.id);
    const prerequisitesMet = node.prerequisites.every((entry) =>
      completedNodeIds.has(entry.prerequisiteNodeId)
    );

    let status: CompanyResearchStatus;
    if (completedNodeIds.has(node.id)) {
      status = CompanyResearchStatus.COMPLETED;
    } else if (runningJob) {
      status = CompanyResearchStatus.RESEARCHING;
    } else if (prerequisitesMet) {
      status = CompanyResearchStatus.AVAILABLE;
    } else {
      status = CompanyResearchStatus.LOCKED;
    }

    return {
      id: node.id,
      code: node.code,
      name: node.name,
      description: node.description,
      costCashCents: node.costCashCents,
      durationTicks: node.durationTicks,
      status,
      tickStarted: runningJob?.tickStarted ?? row?.tickStarted ?? null,
      tickCompletes: runningJob?.tickCompletes ?? row?.tickCompletes ?? null,
      prerequisites: node.prerequisites.map((entry) => ({
        nodeId: entry.prerequisiteNodeId
      })),
      unlockRecipes: node.unlockRecipes.map((entry) => ({
        recipeId: entry.recipe.id,
        recipeCode: entry.recipe.code,
        recipeName: entry.recipe.name
      }))
    };
  });
}

export async function startResearch(prisma: PrismaClient, input: StartResearchInput) {
  validateCompanyId(input.companyId);
  validateNodeId(input.nodeId);

  return prisma.$transaction(async (tx) => {
    const tick = await resolveTick(tx, input.tick);
    const company = await assertResearchableCompany(tx, input.companyId);

    const node = await tx.researchNode.findUnique({
      where: { id: input.nodeId },
      include: {
        prerequisites: {
          select: {
            prerequisiteNodeId: true
          }
        }
      }
    });

    if (!node) {
      throw new NotFoundError(`research node ${input.nodeId} not found`);
    }

    const [existingResearch, existingRunningJob, completedPrerequisites] = await Promise.all([
      tx.companyResearch.findUnique({
        where: {
          companyId_nodeId: {
            companyId: input.companyId,
            nodeId: input.nodeId
          }
        },
        select: {
          status: true
        }
      }),
      tx.researchJob.findFirst({
        where: {
          companyId: input.companyId,
          nodeId: input.nodeId,
          status: ResearchJobStatus.RUNNING
        },
        select: {
          id: true
        }
      }),
      getCompletedPrerequisiteSet(tx, input.companyId)
    ]);

    if (existingResearch?.status === CompanyResearchStatus.COMPLETED) {
      throw new DomainInvariantError("research node already completed");
    }
    if (existingRunningJob || existingResearch?.status === CompanyResearchStatus.RESEARCHING) {
      throw new DomainInvariantError("research node is already running");
    }

    const prerequisitesMet = node.prerequisites.every((entry) =>
      completedPrerequisites.has(entry.prerequisiteNodeId)
    );
    if (!prerequisitesMet) {
      throw new DomainInvariantError("research prerequisites are not completed");
    }
    if (company.cashCents < node.costCashCents) {
      throw new DomainInvariantError("insufficient cash for research");
    }

    const nextCash = company.cashCents - node.costCashCents;
    await tx.company.update({
      where: { id: company.id },
      data: {
        cashCents: nextCash
      }
    });

    const tickCompletes = tick + node.durationTicks;
    const job = await tx.researchJob.create({
      data: {
        companyId: input.companyId,
        nodeId: input.nodeId,
        status: ResearchJobStatus.RUNNING,
        costCashCents: node.costCashCents,
        tickStarted: tick,
        tickCompletes
      }
    });

    await tx.companyResearch.upsert({
      where: {
        companyId_nodeId: {
          companyId: input.companyId,
          nodeId: input.nodeId
        }
      },
      create: {
        companyId: input.companyId,
        nodeId: input.nodeId,
        status: CompanyResearchStatus.RESEARCHING,
        tickStarted: tick,
        tickCompletes
      },
      update: {
        status: CompanyResearchStatus.RESEARCHING,
        tickStarted: tick,
        tickCompletes
      }
    });

    await tx.ledgerEntry.create({
      data: {
        companyId: input.companyId,
        tick,
        entryType: LedgerEntryType.RESEARCH_PAYMENT,
        deltaCashCents: -node.costCashCents,
        deltaReservedCashCents: 0n,
        balanceAfterCents: nextCash,
        referenceType: "RESEARCH_NODE",
        referenceId: node.id
      }
    });

    return {
      id: job.id,
      companyId: job.companyId,
      nodeId: job.nodeId,
      status: job.status,
      costCashCents: job.costCashCents,
      tickStarted: job.tickStarted,
      tickCompletes: job.tickCompletes,
      tickClosed: job.tickClosed,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt
    };
  });
}

export async function cancelResearch(prisma: PrismaClient, input: CancelResearchInput) {
  validateCompanyId(input.companyId);
  validateNodeId(input.nodeId);

  return prisma.$transaction(async (tx) => {
    const tick = await resolveTick(tx, input.tick);
    await assertResearchableCompany(tx, input.companyId);

    const runningJob = await tx.researchJob.findFirst({
      where: {
        companyId: input.companyId,
        nodeId: input.nodeId,
        status: ResearchJobStatus.RUNNING
      },
      include: {
        node: {
          include: {
            prerequisites: {
              select: {
                prerequisiteNodeId: true
              }
            }
          }
        }
      }
    });

    if (!runningJob) {
      throw new DomainInvariantError("research node is not running");
    }

    await tx.researchJob.update({
      where: {
        id: runningJob.id
      },
      data: {
        status: ResearchJobStatus.CANCELLED,
        tickClosed: tick
      }
    });

    const completedPrerequisites = await getCompletedPrerequisiteSet(tx, input.companyId);
    const prerequisitesMet = runningJob.node.prerequisites.every((entry) =>
      completedPrerequisites.has(entry.prerequisiteNodeId)
    );

    await tx.companyResearch.upsert({
      where: {
        companyId_nodeId: {
          companyId: input.companyId,
          nodeId: input.nodeId
        }
      },
      create: {
        companyId: input.companyId,
        nodeId: input.nodeId,
        status: prerequisitesMet
          ? CompanyResearchStatus.AVAILABLE
          : CompanyResearchStatus.LOCKED
      },
      update: {
        status: prerequisitesMet
          ? CompanyResearchStatus.AVAILABLE
          : CompanyResearchStatus.LOCKED
      }
    });

    return {
      id: runningJob.id,
      companyId: runningJob.companyId,
      nodeId: runningJob.nodeId,
      status: ResearchJobStatus.CANCELLED,
      costCashCents: runningJob.costCashCents,
      tickStarted: runningJob.tickStarted,
      tickCompletes: runningJob.tickCompletes,
      tickClosed: tick,
      createdAt: runningJob.createdAt,
      updatedAt: runningJob.updatedAt
    };
  });
}

export async function completeDueResearchJobs(
  tx: Prisma.TransactionClient,
  tick: number
): Promise<void> {
  validateTick(tick, "tick");

  const dueJobs = await tx.researchJob.findMany({
    where: {
      status: ResearchJobStatus.RUNNING,
      tickCompletes: {
        lte: tick
      }
    },
    orderBy: [{ tickCompletes: "asc" }, { createdAt: "asc" }],
    include: {
      node: {
        include: {
          unlockRecipes: {
            select: {
              recipeId: true
            }
          }
        }
      }
    }
  });

  for (const job of dueJobs) {
    await tx.researchJob.update({
      where: { id: job.id },
      data: {
        status: ResearchJobStatus.COMPLETED,
        tickClosed: tick
      }
    });

    await tx.companyResearch.upsert({
      where: {
        companyId_nodeId: {
          companyId: job.companyId,
          nodeId: job.nodeId
        }
      },
      create: {
        companyId: job.companyId,
        nodeId: job.nodeId,
        status: CompanyResearchStatus.COMPLETED,
        tickStarted: job.tickStarted,
        tickCompletes: job.tickCompletes
      },
      update: {
        status: CompanyResearchStatus.COMPLETED,
        tickStarted: job.tickStarted,
        tickCompletes: job.tickCompletes
      }
    });

    for (const unlock of job.node.unlockRecipes) {
      await tx.companyRecipe.upsert({
        where: {
          companyId_recipeId: {
            companyId: job.companyId,
            recipeId: unlock.recipeId
          }
        },
        create: {
          companyId: job.companyId,
          recipeId: unlock.recipeId,
          isUnlocked: true
        },
        update: {
          isUnlocked: true
        }
      });
    }
  }
}

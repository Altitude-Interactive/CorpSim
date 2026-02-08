import { Prisma, PrismaClient, ResearchJobStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  DomainInvariantError,
  completeDueResearchJobs,
  startResearch
} from "../src";

function createPrismaTransactionMock(tx: Prisma.TransactionClient): PrismaClient {
  return {
    $transaction: async <T>(
      callback: (transactionClient: Prisma.TransactionClient) => Promise<T>
    ): Promise<T> => callback(tx)
  } as unknown as PrismaClient;
}

describe("research service", () => {
  it("enforces prerequisite gating before starting research", async () => {
    const companyUpdate = vi.fn();
    const ledgerCreate = vi.fn();

    const tx = {
      worldTickState: {
        findUnique: vi.fn().mockResolvedValue({ currentTick: 7 })
      },
      company: {
        findUnique: vi.fn().mockResolvedValue({
          id: "company-1",
          isPlayer: true,
          ownerPlayerId: "player-1",
          cashCents: 100_000n
        }),
        update: companyUpdate
      },
      researchNode: {
        findUnique: vi.fn().mockResolvedValue({
          id: "node-1",
          costCashCents: 5_000n,
          durationTicks: 4,
          prerequisites: [{ prerequisiteNodeId: "node-prereq" }]
        })
      },
      companyResearch: {
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        upsert: vi.fn()
      },
      researchJob: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn()
      },
      ledgerEntry: {
        create: ledgerCreate
      }
    } as unknown as Prisma.TransactionClient;

    const prisma = createPrismaTransactionMock(tx);

    await expect(
      startResearch(prisma, {
        companyId: "company-1",
        nodeId: "node-1"
      })
    ).rejects.toThrow(DomainInvariantError);

    expect(companyUpdate).not.toHaveBeenCalled();
    expect(ledgerCreate).not.toHaveBeenCalled();
  });

  it("charges cash and records research payment ledger on start", async () => {
    const companyUpdate = vi.fn().mockResolvedValue(null);
    const ledgerCreate = vi.fn().mockResolvedValue(null);
    const jobCreate = vi.fn().mockResolvedValue({
      id: "job-1",
      companyId: "company-1",
      nodeId: "node-1",
      status: ResearchJobStatus.RUNNING,
      costCashCents: 5_000n,
      tickStarted: 9,
      tickCompletes: 12,
      tickClosed: null,
      createdAt: new Date("2026-02-08T19:00:00.000Z"),
      updatedAt: new Date("2026-02-08T19:00:00.000Z")
    });

    const tx = {
      worldTickState: {
        findUnique: vi.fn().mockResolvedValue({ currentTick: 9 })
      },
      company: {
        findUnique: vi.fn().mockResolvedValue({
          id: "company-1",
          isPlayer: true,
          ownerPlayerId: "player-1",
          cashCents: 50_000n
        }),
        update: companyUpdate
      },
      researchNode: {
        findUnique: vi.fn().mockResolvedValue({
          id: "node-1",
          costCashCents: 5_000n,
          durationTicks: 3,
          prerequisites: [{ prerequisiteNodeId: "node-prereq" }]
        })
      },
      companyResearch: {
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([{ nodeId: "node-prereq" }]),
        upsert: vi.fn().mockResolvedValue(null)
      },
      researchJob: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: jobCreate
      },
      ledgerEntry: {
        create: ledgerCreate
      }
    } as unknown as Prisma.TransactionClient;

    const prisma = createPrismaTransactionMock(tx);
    await startResearch(prisma, { companyId: "company-1", nodeId: "node-1" });

    expect(companyUpdate).toHaveBeenCalledWith({
      where: { id: "company-1" },
      data: {
        cashCents: 45_000n
      }
    });

    expect(ledgerCreate).toHaveBeenCalledWith({
      data: {
        companyId: "company-1",
        tick: 9,
        entryType: "RESEARCH_PAYMENT",
        deltaCashCents: -5_000n,
        deltaReservedCashCents: 0n,
        balanceAfterCents: 45_000n,
        referenceType: "RESEARCH_NODE",
        referenceId: "node-1"
      }
    });
  });

  it("completes due jobs and unlocks recipes", async () => {
    const researchJobUpdate = vi.fn().mockResolvedValue(null);
    const companyResearchUpsert = vi.fn().mockResolvedValue(null);
    const companyRecipeUpsert = vi.fn().mockResolvedValue(null);

    const tx = {
      researchJob: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "job-1",
            companyId: "company-1",
            nodeId: "node-1",
            status: ResearchJobStatus.RUNNING,
            costCashCents: 5_000n,
            tickStarted: 8,
            tickCompletes: 10,
            tickClosed: null,
            node: {
              unlockRecipes: [{ recipeId: "recipe-1" }, { recipeId: "recipe-2" }]
            }
          }
        ]),
        update: researchJobUpdate
      },
      companyResearch: {
        upsert: companyResearchUpsert
      },
      companyRecipe: {
        upsert: companyRecipeUpsert
      }
    } as unknown as Prisma.TransactionClient;

    await completeDueResearchJobs(tx, 10);

    expect(researchJobUpdate).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: {
        status: ResearchJobStatus.COMPLETED,
        tickClosed: 10
      }
    });

    expect(companyResearchUpsert).toHaveBeenCalledWith({
      where: {
        companyId_nodeId: {
          companyId: "company-1",
          nodeId: "node-1"
        }
      },
      create: {
        companyId: "company-1",
        nodeId: "node-1",
        status: "COMPLETED",
        tickStarted: 8,
        tickCompletes: 10
      },
      update: {
        status: "COMPLETED",
        tickStarted: 8,
        tickCompletes: 10
      }
    });

    expect(companyRecipeUpsert).toHaveBeenNthCalledWith(1, {
      where: {
        companyId_recipeId: {
          companyId: "company-1",
          recipeId: "recipe-1"
        }
      },
      create: {
        companyId: "company-1",
        recipeId: "recipe-1",
        isUnlocked: true
      },
      update: {
        isUnlocked: true
      }
    });

    expect(companyRecipeUpsert).toHaveBeenNthCalledWith(2, {
      where: {
        companyId_recipeId: {
          companyId: "company-1",
          recipeId: "recipe-2"
        }
      },
      create: {
        companyId: "company-1",
        recipeId: "recipe-2",
        isUnlocked: true
      },
      update: {
        isUnlocked: true
      }
    });
  });
});

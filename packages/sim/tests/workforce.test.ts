import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  assertValidWorkforceAllocation,
  DomainInvariantError,
  requestCompanyWorkforceCapacityChange,
  runWorkforceForTick
} from "../src";
import { createPrismaTransactionMock } from "./test-utils";

describe("workforce service", () => {
  it("validates allocation percentages sum to 100", () => {
    expect(() =>
      assertValidWorkforceAllocation({
        operationsPct: 40,
        researchPct: 20,
        logisticsPct: 20,
        corporatePct: 10
      })
    ).toThrow(DomainInvariantError);
  });

  it("posts deterministic weekly salary ledger entries", async () => {
    const companyUpdate = vi.fn().mockResolvedValue(null);
    const ledgerCreate = vi.fn().mockResolvedValue(null);

    const tx = {
      workforceCapacityDelta: {
        findMany: vi.fn().mockResolvedValue([]),
        groupBy: vi.fn().mockResolvedValue([])
      },
      company: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "company-1",
            cashCents: 50_000n,
            reservedCashCents: 0n,
            workforceCapacity: 10,
            workforceAllocationOpsPct: 40,
            workforceAllocationRngPct: 20,
            workforceAllocationLogPct: 20,
            workforceAllocationCorpPct: 20,
            orgEfficiencyBps: 7_000,
            region: {
              code: "CORE"
            }
          }
        ]),
        update: companyUpdate
      },
      ledgerEntry: {
        create: ledgerCreate
      }
    } as unknown as Prisma.TransactionClient;

    await runWorkforceForTick(tx, 8, {
      baseSalaryPerCapacityCents: 100n,
      hiringShockPerCapacityBps: 0,
      lowCorporatePenaltyBps: 0,
      salaryShortfallPenaltyBps: 0,
      corporateRecoveryPerTickAt100PctBps: 0
    });

    expect(companyUpdate).toHaveBeenCalledWith({
      where: { id: "company-1" },
      data: {
        cashCents: 49_000n,
        orgEfficiencyBps: 7_000
      }
    });
    expect(ledgerCreate).toHaveBeenCalledWith({
      data: {
        companyId: "company-1",
        tick: 8,
        entryType: "WORKFORCE_SALARY_EXPENSE",
        deltaCashCents: -1_000n,
        deltaReservedCashCents: 0n,
        balanceAfterCents: 49_000n,
        referenceType: "WORKFORCE_SALARY",
        referenceId: "company-1:8"
      }
    });
  });

  it("applies hiring arrivals exactly once at tickArrives", async () => {
    const deltaUpdateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    const companyUpdate = vi.fn().mockResolvedValue(null);

    const tx = {
      workforceCapacityDelta: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "delta-1",
            companyId: "company-1",
            deltaCapacity: 3
          }
        ]),
        updateMany: deltaUpdateMany,
        groupBy: vi.fn().mockResolvedValue([])
      },
      company: {
        findMany: vi.fn().mockResolvedValue([]),
        update: companyUpdate
      },
      ledgerEntry: {
        create: vi.fn()
      }
    } as unknown as Prisma.TransactionClient;

    await runWorkforceForTick(tx, 11);
    await runWorkforceForTick(tx, 11);

    expect(companyUpdate).toHaveBeenCalledTimes(1);
    expect(companyUpdate).toHaveBeenCalledWith({
      where: { id: "company-1" },
      data: {
        workforceCapacity: {
          increment: 3
        }
      }
    });
  });

  it("applies layoffs immediately and clamps efficiency to zero", async () => {
    const companyUpdate = vi.fn().mockResolvedValue(null);

    const tx = {
      worldTickState: {
        findUnique: vi.fn().mockResolvedValue({ currentTick: 15 })
      },
      company: {
        findUnique: vi.fn().mockResolvedValue({
          id: "company-1",
          cashCents: 100_000n,
          reservedCashCents: 0n,
          workforceCapacity: 10,
          workforceAllocationOpsPct: 40,
          workforceAllocationRngPct: 20,
          workforceAllocationLogPct: 20,
          workforceAllocationCorpPct: 20,
          orgEfficiencyBps: 200
        }),
        update: companyUpdate
      }
    } as unknown as Prisma.TransactionClient;

    const prisma = createPrismaTransactionMock(tx);
    const result = await requestCompanyWorkforceCapacityChange(prisma, {
      companyId: "company-1",
      deltaCapacity: -5
    });

    expect(result).toMatchObject({
      companyId: "company-1",
      deltaCapacity: -5,
      appliedImmediately: true,
      tickRequested: 15,
      tickArrives: null,
      workforceCapacity: 5,
      orgEfficiencyBps: 0
    });
    expect(companyUpdate).toHaveBeenCalledWith({
      where: { id: "company-1" },
      data: {
        workforceCapacity: 5,
        orgEfficiencyBps: 0
      }
    });
  });

  it("clamps efficiency updates between 0 and 10000", async () => {
    const companyUpdate = vi.fn().mockResolvedValue(null);

    const tx = {
      workforceCapacityDelta: {
        findMany: vi.fn().mockResolvedValue([]),
        groupBy: vi.fn().mockResolvedValue([
          {
            companyId: "a-low",
            _sum: {
              deltaCapacity: 100
            }
          }
        ])
      },
      company: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "a-low",
            cashCents: 0n,
            reservedCashCents: 0n,
            workforceCapacity: 10,
            workforceAllocationOpsPct: 40,
            workforceAllocationRngPct: 30,
            workforceAllocationLogPct: 30,
            workforceAllocationCorpPct: 0,
            orgEfficiencyBps: 50,
            region: {
              code: "CORE"
            }
          },
          {
            id: "z-high",
            cashCents: 1_000n,
            reservedCashCents: 0n,
            workforceCapacity: 0,
            workforceAllocationOpsPct: 0,
            workforceAllocationRngPct: 0,
            workforceAllocationLogPct: 0,
            workforceAllocationCorpPct: 100,
            orgEfficiencyBps: 9_995,
            region: {
              code: "CORE"
            }
          }
        ]),
        update: companyUpdate
      },
      ledgerEntry: {
        create: vi.fn().mockResolvedValue(null)
      }
    } as unknown as Prisma.TransactionClient;

    await runWorkforceForTick(tx, 20);

    expect(companyUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: "a-low" },
      data: {
        cashCents: 0n,
        orgEfficiencyBps: 0
      }
    });
    expect(companyUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: "z-high" },
      data: {
        cashCents: 1_000n,
        orgEfficiencyBps: 10_000
      }
    });
  });
});

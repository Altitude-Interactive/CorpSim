import { BuildingStatus, BuildingType, Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  DomainInvariantError,
  InsufficientFundsError,
  NotFoundError,
  acquireBuildingWithTx,
  applyBuildingOperatingCostsWithTx,
  reactivateBuildingWithTx,
  getProductionCapacityForCompany,
  BUILDING_OPERATING_COST_INTERVAL_TICKS
} from "../src";

describe("building service", () => {
  describe("acquireBuildingWithTx", () => {
    it("validates input parameters", async () => {
      const tx = {} as any;

      await expect(
        acquireBuildingWithTx(tx, {
          companyId: "",
          regionId: "region-1",
          buildingType: BuildingType.FACTORY,
          acquisitionCostCents: 10000n,
          weeklyOperatingCostCents: 500n,
          tick: 10
        })
      ).rejects.toThrow(DomainInvariantError);

      await expect(
        acquireBuildingWithTx(tx, {
          companyId: "company-1",
          regionId: "region-1",
          buildingType: BuildingType.FACTORY,
          acquisitionCostCents: -100n,
          weeklyOperatingCostCents: 500n,
          tick: 10
        })
      ).rejects.toThrow(DomainInvariantError);

      await expect(
        acquireBuildingWithTx(tx, {
          companyId: "company-1",
          regionId: "region-1",
          buildingType: BuildingType.FACTORY,
          acquisitionCostCents: 10000n,
          weeklyOperatingCostCents: -500n,
          tick: 10
        })
      ).rejects.toThrow(DomainInvariantError);

      await expect(
        acquireBuildingWithTx(tx, {
          companyId: "company-1",
          regionId: "region-1",
          buildingType: BuildingType.FACTORY,
          acquisitionCostCents: 10000n,
          weeklyOperatingCostCents: 500n,
          capacitySlots: 0,
          tick: 10
        })
      ).rejects.toThrow(DomainInvariantError);
    });

    it("throws NotFoundError if company doesn't exist", async () => {
      const tx = {
        company: {
          findUnique: vi.fn().mockResolvedValue(null)
        },
        building: {},
        region: {}
      } as unknown as Prisma.TransactionClient;

      await expect(
        acquireBuildingWithTx(tx, {
          companyId: "nonexistent",
          regionId: "region-1",
          buildingType: BuildingType.FACTORY,
          acquisitionCostCents: 10000n,
          weeklyOperatingCostCents: 500n,
          tick: 10
        })
      ).rejects.toThrow(NotFoundError);
    });

    it("throws InsufficientFundsError if company cannot afford acquisition cost", async () => {
      const tx = {
        company: {
          findUnique: vi.fn().mockResolvedValue({
            id: "company-1",
            cashCents: 5000n,
            reservedCashCents: 1000n
          })
        },
        region: {
          findUnique: vi.fn().mockResolvedValue({ id: "region-1" })
        }
      } as unknown as Prisma.TransactionClient;

      await expect(
        acquireBuildingWithTx(tx, {
          companyId: "company-1",
          regionId: "region-1",
          buildingType: BuildingType.FACTORY,
          acquisitionCostCents: 10000n,
          weeklyOperatingCostCents: 500n,
          tick: 10
        })
      ).rejects.toThrow(InsufficientFundsError);
    });

    it("creates building and deducts acquisition cost with ledger entry", async () => {
      const companyUpdate = vi.fn().mockResolvedValue(null);
      const buildingCreate = vi.fn().mockResolvedValue({
        id: "building-1",
        companyId: "company-1",
        regionId: "region-1",
        buildingType: BuildingType.FACTORY,
        status: BuildingStatus.ACTIVE,
        acquisitionCostCents: 10000n,
        weeklyOperatingCostCents: 500n,
        capacitySlots: 5,
        tickAcquired: 10,
        lastOperatingCostTick: 10
      });
      const ledgerCreate = vi.fn().mockResolvedValue(null);

      const tx = {
        company: {
          findUnique: vi.fn().mockResolvedValue({
            id: "company-1",
            cashCents: 15000n,
            reservedCashCents: 0n
          }),
          update: companyUpdate
        },
        region: {
          findUnique: vi.fn().mockResolvedValue({ id: "region-1" })
        },
        building: {
          create: buildingCreate
        },
        ledgerEntry: {
          create: ledgerCreate
        }
      } as unknown as Prisma.TransactionClient;

      const building = await acquireBuildingWithTx(tx, {
        companyId: "company-1",
        regionId: "region-1",
        buildingType: BuildingType.FACTORY,
        acquisitionCostCents: 10000n,
        weeklyOperatingCostCents: 500n,
        capacitySlots: 5,
        tick: 10
      });

      expect(building.id).toBe("building-1");
      expect(companyUpdate).toHaveBeenCalledWith({
        where: { id: "company-1" },
        data: { cashCents: 5000n }
      });

      expect(buildingCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: "company-1",
          regionId: "region-1",
          buildingType: BuildingType.FACTORY,
          status: BuildingStatus.ACTIVE,
          acquisitionCostCents: 10000n,
          weeklyOperatingCostCents: 500n,
          capacitySlots: 5,
          tickAcquired: 10,
          lastOperatingCostTick: 10
        })
      });

      expect(ledgerCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: "company-1",
          tick: 10,
          entryType: "BUILDING_ACQUISITION",
          deltaCashCents: -10000n,
          balanceAfterCents: 5000n,
          referenceType: "BUILDING",
          referenceId: "building-1"
        })
      });
    });
  });

  describe("applyBuildingOperatingCostsWithTx", () => {
    it("applies operating costs to buildings due for payment", async () => {
      const companyUpdate = vi.fn().mockResolvedValue(null);
      const buildingUpdate = vi.fn().mockResolvedValue(null);
      const ledgerCreate = vi.fn().mockResolvedValue(null);

      const tx = {
        building: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "building-1",
              companyId: "company-1",
              weeklyOperatingCostCents: 500n,
              lastOperatingCostTick: 10,
              company: {
                id: "company-1",
                cashCents: 10000n,
                reservedCashCents: 0n
              }
            },
            {
              id: "building-2",
              companyId: "company-2",
              weeklyOperatingCostCents: 300n,
              lastOperatingCostTick: 10,
              company: {
                id: "company-2",
                cashCents: 5000n,
                reservedCashCents: 0n
              }
            }
          ]),
          update: buildingUpdate
        },
        company: {
          update: companyUpdate
        },
        ledgerEntry: {
          create: ledgerCreate
        }
      } as unknown as Prisma.TransactionClient;

      const currentTick = 10 + BUILDING_OPERATING_COST_INTERVAL_TICKS;
      const result = await applyBuildingOperatingCostsWithTx(tx, {
        tick: currentTick
      });

      expect(result.processedCount).toBe(2);
      expect(result.deactivatedCount).toBe(0);
      expect(result.totalCostCents).toBe(800n);

      expect(companyUpdate).toHaveBeenCalledTimes(2);
      expect(buildingUpdate).toHaveBeenCalledTimes(2);
      expect(ledgerCreate).toHaveBeenCalledTimes(2);
    });

    it("deactivates buildings when company cannot afford operating cost", async () => {
      const buildingUpdate = vi.fn().mockResolvedValue(null);

      const tx = {
        building: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "building-1",
              companyId: "company-1",
              weeklyOperatingCostCents: 500n,
              lastOperatingCostTick: 10,
              company: {
                id: "company-1",
                cashCents: 100n, // Insufficient
                reservedCashCents: 0n
              }
            }
          ]),
          update: buildingUpdate
        },
        company: {
          update: vi.fn()
        },
        ledgerEntry: {
          create: vi.fn()
        }
      } as unknown as Prisma.TransactionClient;

      const currentTick = 10 + BUILDING_OPERATING_COST_INTERVAL_TICKS;
      const result = await applyBuildingOperatingCostsWithTx(tx, {
        tick: currentTick
      });

      expect(result.processedCount).toBe(0);
      expect(result.deactivatedCount).toBe(1);
      expect(result.totalCostCents).toBe(0n);

      expect(buildingUpdate).toHaveBeenCalledWith({
        where: { id: "building-1" },
        data: {
          status: BuildingStatus.INACTIVE,
          lastOperatingCostTick: currentTick
        }
      });
    });

    it("skips buildings not yet due for operating cost", async () => {
      const tx = {
        building: {
          findMany: vi.fn().mockResolvedValue([])
        }
      } as unknown as Prisma.TransactionClient;

      const result = await applyBuildingOperatingCostsWithTx(tx, {
        tick: 10
      });

      expect(result.processedCount).toBe(0);
      expect(result.deactivatedCount).toBe(0);
      expect(result.totalCostCents).toBe(0n);
    });
  });

  describe("reactivateBuildingWithTx", () => {
    it("reactivates an inactive building", async () => {
      const buildingUpdate = vi.fn().mockResolvedValue({
        id: "building-1",
        status: BuildingStatus.ACTIVE
      });

      const tx = {
        building: {
          findUnique: vi.fn().mockResolvedValue({
            id: "building-1",
            status: BuildingStatus.INACTIVE
          }),
          update: buildingUpdate
        }
      } as unknown as Prisma.TransactionClient;

      const result = await reactivateBuildingWithTx(tx, {
        buildingId: "building-1",
        tick: 20
      });

      expect(result.status).toBe(BuildingStatus.ACTIVE);
      expect(buildingUpdate).toHaveBeenCalledWith({
        where: { id: "building-1" },
        data: {
          status: BuildingStatus.ACTIVE,
          lastOperatingCostTick: 20
        }
      });
    });

    it("throws error if building is not inactive", async () => {
      const tx = {
        building: {
          findUnique: vi.fn().mockResolvedValue({
            id: "building-1",
            status: BuildingStatus.ACTIVE
          })
        }
      } as unknown as Prisma.TransactionClient;

      await expect(
        reactivateBuildingWithTx(tx, {
          buildingId: "building-1",
          tick: 20
        })
      ).rejects.toThrow(DomainInvariantError);
    });

    it("throws NotFoundError if building doesn't exist", async () => {
      const tx = {
        building: {
          findUnique: vi.fn().mockResolvedValue(null)
        }
      } as unknown as Prisma.TransactionClient;

      await expect(
        reactivateBuildingWithTx(tx, {
          buildingId: "nonexistent",
          tick: 20
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("getProductionCapacityForCompany", () => {
    it("calculates total and used production capacity", async () => {
      const tx = {
        building: {
          findMany: vi.fn().mockResolvedValue([
            { capacitySlots: 5 },
            { capacitySlots: 3 },
            { capacitySlots: 10 }
          ])
        },
        productionJob: {
          count: vi.fn().mockResolvedValue(7)
        }
      } as unknown as Prisma.TransactionClient;

      const result = await getProductionCapacityForCompany(tx, "company-1");

      expect(result.totalCapacity).toBe(18);
      expect(result.usedCapacity).toBe(7);
    });

    it("returns zero capacity when no buildings exist", async () => {
      const tx = {
        building: {
          findMany: vi.fn().mockResolvedValue([])
        },
        productionJob: {
          count: vi.fn().mockResolvedValue(0)
        }
      } as unknown as Prisma.TransactionClient;

      const result = await getProductionCapacityForCompany(tx, "company-1");

      expect(result.totalCapacity).toBe(0);
      expect(result.usedCapacity).toBe(0);
    });
  });
});

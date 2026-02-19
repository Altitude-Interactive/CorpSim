import { BuildingType, BuildingStatus, Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  DomainInvariantError,
  calculateRegionalStorageCapacity,
  validateStorageCapacity,
  BASE_STORAGE_CAPACITY_PER_REGION,
  WAREHOUSE_CAPACITY_PER_SLOT
} from "../src";

describe("storage capacity system", () => {
  it("calculates base storage capacity correctly", () => {
    const capacity = calculateRegionalStorageCapacity(0);
    expect(capacity).toBe(BASE_STORAGE_CAPACITY_PER_REGION);
  });

  it("adds warehouse capacity to base", () => {
    const capacity = calculateRegionalStorageCapacity(2);
    expect(capacity).toBe(BASE_STORAGE_CAPACITY_PER_REGION + (2 * WAREHOUSE_CAPACITY_PER_SLOT));
  });

  it("validates storage capacity and throws on overflow", async () => {
    const tx = {
      inventory: {
        aggregate: vi.fn().mockResolvedValue({
          _sum: { quantity: 900 }
        })
      },
      building: {
        count: vi.fn().mockResolvedValue(0) // No warehouses
      }
    } as unknown as Prisma.TransactionClient;

    // Should fail: 900 + 200 = 1100 > 1000 base capacity
    await expect(
      validateStorageCapacity(tx, "company-1", "region-1", 200)
    ).rejects.toThrow(DomainInvariantError);
  });

  it("allows storage within capacity", async () => {
    const tx = {
      inventory: {
        aggregate: vi.fn().mockResolvedValue({
          _sum: { quantity: 500 }
        })
      },
      building: {
        count: vi.fn().mockResolvedValue(1) // 1 warehouse = 1500 total capacity
      }
    } as unknown as Prisma.TransactionClient;

    // Should succeed: 500 + 800 = 1300 < 1500
    await expect(
      validateStorageCapacity(tx, "company-1", "region-1", 800)
    ).resolves.not.toThrow();
  });

  it("throws on negative warehouse count", () => {
    expect(() => calculateRegionalStorageCapacity(-1)).toThrow(DomainInvariantError);
  });

  it("throws on negative capacity per warehouse", () => {
    expect(() => calculateRegionalStorageCapacity(1, -500)).toThrow(DomainInvariantError);
  });

  it("throws on negative base capacity", () => {
    expect(() => calculateRegionalStorageCapacity(1, 500, -1000)).toThrow(DomainInvariantError);
  });

  it("validates required parameters in validateStorageCapacity", async () => {
    const tx = {
      inventory: {
        aggregate: vi.fn().mockResolvedValue({
          _sum: { quantity: 0 }
        })
      },
      building: {
        count: vi.fn().mockResolvedValue(0)
      }
    } as unknown as Prisma.TransactionClient;

    await expect(
      validateStorageCapacity(tx, "", "region-1", 100)
    ).rejects.toThrow(DomainInvariantError);

    await expect(
      validateStorageCapacity(tx, "company-1", "", 100)
    ).rejects.toThrow(DomainInvariantError);

    await expect(
      validateStorageCapacity(tx, "company-1", "region-1", -10)
    ).rejects.toThrow(DomainInvariantError);
  });
});

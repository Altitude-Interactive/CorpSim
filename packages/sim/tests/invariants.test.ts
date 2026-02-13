import { describe, expect, it } from "vitest";
import {
  collectCompanyInvariantIssues,
  collectInventoryInvariantIssues
} from "../src/services/invariants";

describe("invariants scanner", () => {
  it("detects invalid company cash states", () => {
    const issues = collectCompanyInvariantIssues([
      {
        id: "company-a",
        cashCents: -1n,
        reservedCashCents: 0n,
        workforceCapacity: 0,
        workforceAllocationOpsPct: 40,
        workforceAllocationRngPct: 20,
        workforceAllocationLogPct: 20,
        workforceAllocationCorpPct: 20,
        orgEfficiencyBps: 7000
      },
      {
        id: "company-b",
        cashCents: 100n,
        reservedCashCents: 200n,
        workforceCapacity: 0,
        workforceAllocationOpsPct: 40,
        workforceAllocationRngPct: 20,
        workforceAllocationLogPct: 20,
        workforceAllocationCorpPct: 20,
        orgEfficiencyBps: 7000
      }
    ]);

    expect(issues.map((entry) => entry.code)).toContain("COMPANY_CASH_NEGATIVE");
    expect(issues.map((entry) => entry.code)).toContain("COMPANY_RESERVED_EXCEEDS_CASH");
  });

  it("detects invalid inventory states", () => {
    const issues = collectInventoryInvariantIssues([
      {
        companyId: "company-a",
        itemId: "item-ore",
        quantity: -5,
        reservedQuantity: 0
      },
      {
        companyId: "company-b",
        itemId: "item-ingot",
        quantity: 10,
        reservedQuantity: 20
      }
    ]);

    expect(issues.map((entry) => entry.code)).toContain("INVENTORY_QUANTITY_NEGATIVE");
    expect(issues.map((entry) => entry.code)).toContain("INVENTORY_RESERVED_EXCEEDS_QUANTITY");
  });
});

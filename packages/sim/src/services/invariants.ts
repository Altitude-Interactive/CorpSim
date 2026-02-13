import { Prisma, PrismaClient } from "@prisma/client";

export type InvariantIssueCode =
  | "COMPANY_CASH_NEGATIVE"
  | "COMPANY_RESERVED_CASH_NEGATIVE"
  | "COMPANY_RESERVED_EXCEEDS_CASH"
  | "COMPANY_WORKFORCE_CAPACITY_NEGATIVE"
  | "COMPANY_WORKFORCE_ALLOCATION_INVALID"
  | "COMPANY_ORG_EFFICIENCY_INVALID"
  | "INVENTORY_QUANTITY_NEGATIVE"
  | "INVENTORY_RESERVED_NEGATIVE"
  | "INVENTORY_RESERVED_EXCEEDS_QUANTITY";

export interface InvariantIssue {
  code: InvariantIssueCode;
  entityType: "company" | "inventory";
  companyId: string;
  itemId?: string;
  message: string;
}

export interface InvariantScanResult {
  issues: InvariantIssue[];
  hasViolations: boolean;
  truncated: boolean;
}

const MAX_ISSUES_LIMIT = 50;

interface CompanyInvariantRow {
  id: string;
  cashCents: bigint | number | string;
  reservedCashCents: bigint | number | string;
  workforceCapacity: number;
  workforceAllocationOpsPct: number;
  workforceAllocationRngPct: number;
  workforceAllocationLogPct: number;
  workforceAllocationCorpPct: number;
  orgEfficiencyBps: number;
}

interface InventoryInvariantRow {
  companyId: string;
  itemId: string;
  quantity: number;
  reservedQuantity: number;
}

export function collectCompanyInvariantIssues(rows: CompanyInvariantRow[]): InvariantIssue[] {
  const issues: InvariantIssue[] = [];

  for (const row of rows) {
    const cashCents = BigInt(row.cashCents);
    const reservedCashCents = BigInt(row.reservedCashCents);

    if (cashCents < 0n) {
      issues.push({
        code: "COMPANY_CASH_NEGATIVE",
        entityType: "company",
        companyId: row.id,
        message: "company cashCents is negative"
      });
    }

    if (reservedCashCents < 0n) {
      issues.push({
        code: "COMPANY_RESERVED_CASH_NEGATIVE",
        entityType: "company",
        companyId: row.id,
        message: "company reservedCashCents is negative"
      });
    }

    if (reservedCashCents > cashCents) {
      issues.push({
        code: "COMPANY_RESERVED_EXCEEDS_CASH",
        entityType: "company",
        companyId: row.id,
        message: "company reservedCashCents exceeds cashCents"
      });
    }

    if (row.workforceCapacity < 0) {
      issues.push({
        code: "COMPANY_WORKFORCE_CAPACITY_NEGATIVE",
        entityType: "company",
        companyId: row.id,
        message: "company workforceCapacity is negative"
      });
    }

    const allocationSum =
      row.workforceAllocationOpsPct +
      row.workforceAllocationRngPct +
      row.workforceAllocationLogPct +
      row.workforceAllocationCorpPct;
    const allocationsInRange =
      row.workforceAllocationOpsPct >= 0 &&
      row.workforceAllocationOpsPct <= 100 &&
      row.workforceAllocationRngPct >= 0 &&
      row.workforceAllocationRngPct <= 100 &&
      row.workforceAllocationLogPct >= 0 &&
      row.workforceAllocationLogPct <= 100 &&
      row.workforceAllocationCorpPct >= 0 &&
      row.workforceAllocationCorpPct <= 100;

    if (!allocationsInRange || allocationSum !== 100) {
      issues.push({
        code: "COMPANY_WORKFORCE_ALLOCATION_INVALID",
        entityType: "company",
        companyId: row.id,
        message: "company workforce allocation is invalid"
      });
    }

    if (row.orgEfficiencyBps < 0 || row.orgEfficiencyBps > 10_000) {
      issues.push({
        code: "COMPANY_ORG_EFFICIENCY_INVALID",
        entityType: "company",
        companyId: row.id,
        message: "company orgEfficiencyBps is outside [0, 10000]"
      });
    }
  }

  return issues;
}

export function collectInventoryInvariantIssues(rows: InventoryInvariantRow[]): InvariantIssue[] {
  const issues: InvariantIssue[] = [];

  for (const row of rows) {
    if (row.quantity < 0) {
      issues.push({
        code: "INVENTORY_QUANTITY_NEGATIVE",
        entityType: "inventory",
        companyId: row.companyId,
        itemId: row.itemId,
        message: "inventory quantity is negative"
      });
    }

    if (row.reservedQuantity < 0) {
      issues.push({
        code: "INVENTORY_RESERVED_NEGATIVE",
        entityType: "inventory",
        companyId: row.companyId,
        itemId: row.itemId,
        message: "inventory reservedQuantity is negative"
      });
    }

    if (row.reservedQuantity > row.quantity) {
      issues.push({
        code: "INVENTORY_RESERVED_EXCEEDS_QUANTITY",
        entityType: "inventory",
        companyId: row.companyId,
        itemId: row.itemId,
        message: "inventory reservedQuantity exceeds quantity"
      });
    }
  }

  return issues;
}

function limitIssues(issues: InvariantIssue[], limit: number): InvariantScanResult {
  return {
    issues: issues.slice(0, limit),
    hasViolations: issues.length > 0,
    truncated: issues.length > limit
  };
}

export async function scanSimulationInvariants(
  prisma: PrismaClient | Prisma.TransactionClient,
  limit = 20
): Promise<InvariantScanResult> {
  const requestedLimit = Number.isInteger(limit) && limit > 0 ? limit : 20;
  const safeLimit = Math.min(MAX_ISSUES_LIMIT, requestedLimit);

  const [companyRows, inventoryRows] = await Promise.all([
    prisma.$queryRaw<CompanyInvariantRow[]>`
      SELECT
        id,
        "cashCents",
        "reservedCashCents",
        "workforceCapacity",
        "workforceAllocationOpsPct",
        "workforceAllocationRngPct",
        "workforceAllocationLogPct",
        "workforceAllocationCorpPct",
        "orgEfficiencyBps"
      FROM "Company"
      WHERE "cashCents" < 0
        OR "reservedCashCents" < 0
        OR "reservedCashCents" > "cashCents"
        OR "workforceCapacity" < 0
        OR "workforceAllocationOpsPct" < 0
        OR "workforceAllocationOpsPct" > 100
        OR "workforceAllocationRngPct" < 0
        OR "workforceAllocationRngPct" > 100
        OR "workforceAllocationLogPct" < 0
        OR "workforceAllocationLogPct" > 100
        OR "workforceAllocationCorpPct" < 0
        OR "workforceAllocationCorpPct" > 100
        OR (
          "workforceAllocationOpsPct" +
          "workforceAllocationRngPct" +
          "workforceAllocationLogPct" +
          "workforceAllocationCorpPct"
        ) <> 100
        OR "orgEfficiencyBps" < 0
        OR "orgEfficiencyBps" > 10000
      ORDER BY id ASC
      LIMIT ${safeLimit}
    `,
    prisma.$queryRaw<InventoryInvariantRow[]>`
      SELECT "companyId", "itemId", quantity, "reservedQuantity"
      FROM "Inventory"
      WHERE quantity < 0
        OR "reservedQuantity" < 0
        OR "reservedQuantity" > quantity
      ORDER BY "companyId" ASC, "itemId" ASC
      LIMIT ${safeLimit}
    `
  ]);

  const issues = [
    ...collectCompanyInvariantIssues(companyRows),
    ...collectInventoryInvariantIssues(inventoryRows)
  ];

  return limitIssues(issues, safeLimit);
}

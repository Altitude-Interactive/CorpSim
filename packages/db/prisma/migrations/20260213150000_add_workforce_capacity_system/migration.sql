ALTER TYPE "LedgerEntryType" ADD VALUE IF NOT EXISTS 'WORKFORCE_SALARY_EXPENSE';
ALTER TYPE "LedgerEntryType" ADD VALUE IF NOT EXISTS 'WORKFORCE_RECRUITMENT_EXPENSE';

ALTER TABLE "Company"
  ADD COLUMN "workforceCapacity" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "workforceAllocationOpsPct" INTEGER NOT NULL DEFAULT 40,
  ADD COLUMN "workforceAllocationRngPct" INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN "workforceAllocationLogPct" INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN "workforceAllocationCorpPct" INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN "orgEfficiencyBps" INTEGER NOT NULL DEFAULT 7000;

ALTER TABLE "Company"
  ADD CONSTRAINT "Company_workforceCapacity_nonnegative"
    CHECK ("workforceCapacity" >= 0),
  ADD CONSTRAINT "Company_workforceAllocation_range"
    CHECK (
      "workforceAllocationOpsPct" >= 0 AND "workforceAllocationOpsPct" <= 100 AND
      "workforceAllocationRngPct" >= 0 AND "workforceAllocationRngPct" <= 100 AND
      "workforceAllocationLogPct" >= 0 AND "workforceAllocationLogPct" <= 100 AND
      "workforceAllocationCorpPct" >= 0 AND "workforceAllocationCorpPct" <= 100
    ),
  ADD CONSTRAINT "Company_workforceAllocation_sum_100"
    CHECK (
      "workforceAllocationOpsPct" +
      "workforceAllocationRngPct" +
      "workforceAllocationLogPct" +
      "workforceAllocationCorpPct" = 100
    ),
  ADD CONSTRAINT "Company_orgEfficiencyBps_range"
    CHECK ("orgEfficiencyBps" >= 0 AND "orgEfficiencyBps" <= 10000);

CREATE TABLE "WorkforceCapacityDelta" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "deltaCapacity" INTEGER NOT NULL,
  "tickArrives" INTEGER NOT NULL,
  "tickApplied" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkforceCapacityDelta_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkforceCapacityDelta_companyId_tickArrives_idx"
  ON "WorkforceCapacityDelta"("companyId", "tickArrives");

CREATE INDEX "WorkforceCapacityDelta_tickArrives_tickApplied_idx"
  ON "WorkforceCapacityDelta"("tickArrives", "tickApplied");

ALTER TABLE "WorkforceCapacityDelta"
  ADD CONSTRAINT "WorkforceCapacityDelta_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

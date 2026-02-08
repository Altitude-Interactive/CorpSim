-- AlterTable
ALTER TABLE "LedgerEntry"
ADD COLUMN "deltaReservedCashCents" BIGINT NOT NULL DEFAULT 0;

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('OPEN', 'ACCEPTED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'EXPIRED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "LedgerEntryType" ADD VALUE 'CONTRACT_SETTLEMENT';

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "buyerCompanyId" TEXT NOT NULL,
    "sellerCompanyId" TEXT,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "remainingQuantity" INTEGER NOT NULL,
    "priceCents" BIGINT NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'OPEN',
    "tickCreated" INTEGER NOT NULL,
    "tickExpires" INTEGER NOT NULL,
    "tickAccepted" INTEGER,
    "tickClosed" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractFulfillment" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "sellerCompanyId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "priceCents" BIGINT NOT NULL,
    "tick" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractFulfillment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contract_status_tickExpires_idx" ON "Contract"("status", "tickExpires");

-- CreateIndex
CREATE INDEX "Contract_itemId_status_createdAt_idx" ON "Contract"("itemId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Contract_sellerCompanyId_status_idx" ON "Contract"("sellerCompanyId", "status");

-- CreateIndex
CREATE INDEX "ContractFulfillment_contractId_tick_idx" ON "ContractFulfillment"("contractId", "tick");

-- CreateIndex
CREATE INDEX "ContractFulfillment_sellerCompanyId_tick_idx" ON "ContractFulfillment"("sellerCompanyId", "tick");

-- CreateIndex
CREATE INDEX "ContractFulfillment_itemId_tick_idx" ON "ContractFulfillment"("itemId", "tick");

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_buyerCompanyId_fkey" FOREIGN KEY ("buyerCompanyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_sellerCompanyId_fkey" FOREIGN KEY ("sellerCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractFulfillment" ADD CONSTRAINT "ContractFulfillment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractFulfillment" ADD CONSTRAINT "ContractFulfillment_sellerCompanyId_fkey" FOREIGN KEY ("sellerCompanyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractFulfillment" ADD CONSTRAINT "ContractFulfillment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

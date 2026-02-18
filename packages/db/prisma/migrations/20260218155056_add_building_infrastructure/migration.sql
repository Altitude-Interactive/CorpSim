-- CreateEnum
CREATE TYPE "BuildingType" AS ENUM ('MINE', 'FARM', 'FACTORY', 'MEGA_FACTORY', 'WAREHOUSE', 'HEADQUARTERS', 'RND_CENTER');

-- CreateEnum
CREATE TYPE "BuildingStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'CONSTRUCTION');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LedgerEntryType" ADD VALUE 'BUILDING_OPERATING_COST';
ALTER TYPE "LedgerEntryType" ADD VALUE 'BUILDING_ACQUISITION';

-- AlterTable
ALTER TABLE "ProductionJob" ADD COLUMN     "buildingId" TEXT;

-- AlterTable
ALTER TABLE "SimulationControlState" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SimulationLease" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Building" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "buildingType" "BuildingType" NOT NULL,
    "status" "BuildingStatus" NOT NULL DEFAULT 'ACTIVE',
    "name" TEXT,
    "acquisitionCostCents" BIGINT NOT NULL,
    "weeklyOperatingCostCents" BIGINT NOT NULL,
    "capacitySlots" INTEGER NOT NULL DEFAULT 1,
    "tickAcquired" INTEGER NOT NULL,
    "tickConstructionCompletes" INTEGER,
    "lastOperatingCostTick" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Building_companyId_status_idx" ON "Building"("companyId", "status");

-- CreateIndex
CREATE INDEX "Building_regionId_buildingType_idx" ON "Building"("regionId", "buildingType");

-- CreateIndex
CREATE INDEX "Building_status_lastOperatingCostTick_idx" ON "Building"("status", "lastOperatingCostTick");

-- CreateIndex
CREATE INDEX "ProductionJob_buildingId_status_idx" ON "ProductionJob"("buildingId", "status");

-- AddForeignKey
ALTER TABLE "ProductionJob" ADD CONSTRAINT "ProductionJob_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Building" ADD CONSTRAINT "Building_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Building" ADD CONSTRAINT "Building_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

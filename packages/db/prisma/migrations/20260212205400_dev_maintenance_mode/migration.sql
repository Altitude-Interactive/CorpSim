-- AlterTable
ALTER TABLE "MaintenanceState" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "MarketOrder_regionId_itemId_side_status_unitPriceCents_createdA" RENAME TO "MarketOrder_regionId_itemId_side_status_unitPriceCents_crea_idx";

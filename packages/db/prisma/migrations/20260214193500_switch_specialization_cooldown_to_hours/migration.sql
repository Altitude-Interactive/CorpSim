-- AlterTable
ALTER TABLE "Company"
ADD COLUMN "specializationChangedAt" TIMESTAMP(3),
DROP COLUMN "specializationChangedTick";

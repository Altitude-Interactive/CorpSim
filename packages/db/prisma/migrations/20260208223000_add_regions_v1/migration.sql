DO $$
BEGIN
  CREATE TYPE "ShipmentStatus" AS ENUM ('IN_TRANSIT', 'DELIVERED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TYPE "LedgerEntryType" ADD VALUE 'SHIPMENT_FEE';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "Region" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Region_code_key" ON "Region"("code");

INSERT INTO "Region" ("id", "code", "name", "createdAt", "updatedAt")
VALUES
  ('region_core', 'CORE', 'Core', NOW(), NOW()),
  ('region_industrial', 'INDUSTRIAL', 'Industrial', NOW(), NOW()),
  ('region_frontier', 'FRONTIER', 'Frontier', NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;

ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "regionId" TEXT;

UPDATE "Company"
SET "regionId" = COALESCE("regionId", 'region_core');

ALTER TABLE "Company" ALTER COLUMN "regionId" SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE "Company"
  ADD CONSTRAINT "Company_regionId_fkey"
  FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE INDEX IF NOT EXISTS "Company_regionId_idx" ON "Company"("regionId");

ALTER TABLE "Inventory" ADD COLUMN IF NOT EXISTS "regionId" TEXT;

UPDATE "Inventory" AS inventory
SET "regionId" = company."regionId"
FROM "Company" AS company
WHERE inventory."companyId" = company."id"
  AND inventory."regionId" IS NULL;

ALTER TABLE "Inventory" ALTER COLUMN "regionId" SET NOT NULL;

ALTER TABLE "Inventory" DROP CONSTRAINT IF EXISTS "Inventory_pkey";
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_pkey" PRIMARY KEY ("companyId", "itemId", "regionId");

DO $$
BEGIN
  ALTER TABLE "Inventory"
  ADD CONSTRAINT "Inventory_regionId_fkey"
  FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE INDEX IF NOT EXISTS "Inventory_regionId_idx" ON "Inventory"("regionId");

CREATE TABLE IF NOT EXISTS "Shipment" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "fromRegionId" TEXT NOT NULL,
  "toRegionId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "status" "ShipmentStatus" NOT NULL DEFAULT 'IN_TRANSIT',
  "tickCreated" INTEGER NOT NULL,
  "tickArrives" INTEGER NOT NULL,
  "tickClosed" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Shipment_companyId_status_tickCreated_idx"
  ON "Shipment"("companyId", "status", "tickCreated");
CREATE INDEX IF NOT EXISTS "Shipment_status_tickArrives_idx"
  ON "Shipment"("status", "tickArrives");
CREATE INDEX IF NOT EXISTS "Shipment_fromRegionId_toRegionId_idx"
  ON "Shipment"("fromRegionId", "toRegionId");

DO $$
BEGIN
  ALTER TABLE "Shipment"
  ADD CONSTRAINT "Shipment_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "Shipment"
  ADD CONSTRAINT "Shipment_fromRegionId_fkey"
  FOREIGN KEY ("fromRegionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "Shipment"
  ADD CONSTRAINT "Shipment_toRegionId_fkey"
  FOREIGN KEY ("toRegionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "Shipment"
  ADD CONSTRAINT "Shipment_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

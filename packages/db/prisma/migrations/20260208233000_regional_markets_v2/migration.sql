ALTER TABLE "MarketOrder" ADD COLUMN IF NOT EXISTS "regionId" TEXT;

UPDATE "MarketOrder" AS "order"
SET "regionId" = company."regionId"
FROM "Company" AS company
WHERE "order"."companyId" = company."id"
  AND "order"."regionId" IS NULL;

ALTER TABLE "MarketOrder" ALTER COLUMN "regionId" SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE "MarketOrder"
  ADD CONSTRAINT "MarketOrder_regionId_fkey"
  FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DROP INDEX IF EXISTS "MarketOrder_itemId_side_status_unitPriceCents_createdAt_idx";
CREATE INDEX IF NOT EXISTS "MarketOrder_regionId_itemId_side_status_unitPriceCents_createdAt_idx"
  ON "MarketOrder"("regionId", "itemId", "side", "status", "unitPriceCents", "createdAt");
CREATE INDEX IF NOT EXISTS "MarketOrder_regionId_status_createdAt_idx"
  ON "MarketOrder"("regionId", "status", "createdAt");

ALTER TABLE "Trade" ADD COLUMN IF NOT EXISTS "regionId" TEXT;

UPDATE "Trade" AS trade
SET "regionId" = buy_order."regionId"
FROM "MarketOrder" AS buy_order
WHERE trade."buyOrderId" = buy_order."id"
  AND trade."regionId" IS NULL;

UPDATE "Trade" AS trade
SET "regionId" = company."regionId"
FROM "Company" AS company
WHERE trade."buyerCompanyId" = company."id"
  AND trade."regionId" IS NULL;

ALTER TABLE "Trade" ALTER COLUMN "regionId" SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE "Trade"
  ADD CONSTRAINT "Trade_regionId_fkey"
  FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DROP INDEX IF EXISTS "Trade_itemId_tick_idx";
CREATE INDEX IF NOT EXISTS "Trade_regionId_itemId_tick_idx"
  ON "Trade"("regionId", "itemId", "tick");
CREATE INDEX IF NOT EXISTS "Trade_regionId_tick_idx"
  ON "Trade"("regionId", "tick");

ALTER TABLE "ItemTickCandle" ADD COLUMN IF NOT EXISTS "regionId" TEXT;
UPDATE "ItemTickCandle" SET "regionId" = COALESCE("regionId", 'region_core');
ALTER TABLE "ItemTickCandle" ALTER COLUMN "regionId" SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE "ItemTickCandle"
  ADD CONSTRAINT "ItemTickCandle_regionId_fkey"
  FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DROP INDEX IF EXISTS "ItemTickCandle_itemId_tick_key";
DROP INDEX IF EXISTS "ItemTickCandle_itemId_tick_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "ItemTickCandle_itemId_regionId_tick_key"
  ON "ItemTickCandle"("itemId", "regionId", "tick");
CREATE INDEX IF NOT EXISTS "ItemTickCandle_itemId_regionId_tick_idx"
  ON "ItemTickCandle"("itemId", "regionId", "tick");
CREATE INDEX IF NOT EXISTS "ItemTickCandle_regionId_tick_idx"
  ON "ItemTickCandle"("regionId", "tick");

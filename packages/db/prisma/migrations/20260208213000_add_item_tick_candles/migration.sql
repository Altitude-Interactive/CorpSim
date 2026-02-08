-- CreateTable
CREATE TABLE "ItemTickCandle" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "tick" INTEGER NOT NULL,
    "openCents" BIGINT NOT NULL,
    "highCents" BIGINT NOT NULL,
    "lowCents" BIGINT NOT NULL,
    "closeCents" BIGINT NOT NULL,
    "volumeQty" INTEGER NOT NULL,
    "tradeCount" INTEGER NOT NULL,
    "vwapCents" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemTickCandle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ItemTickCandle_itemId_tick_key" ON "ItemTickCandle"("itemId", "tick");

-- CreateIndex
CREATE INDEX "ItemTickCandle_itemId_tick_idx" ON "ItemTickCandle"("itemId", "tick");

-- AddForeignKey
ALTER TABLE "ItemTickCandle" ADD CONSTRAINT "ItemTickCandle_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

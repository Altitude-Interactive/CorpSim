-- CreateTable
CREATE TABLE "MissingItemLog" (
    "id" TEXT NOT NULL,
    "itemCode" TEXT,
    "itemName" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissingItemLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MissingItemLog_source_createdAt_idx" ON "MissingItemLog"("source", "createdAt");

-- CreateIndex
CREATE INDEX "MissingItemLog_itemCode_idx" ON "MissingItemLog"("itemCode");

-- CreateIndex
CREATE INDEX "MissingItemLog_createdAt_idx" ON "MissingItemLog"("createdAt");

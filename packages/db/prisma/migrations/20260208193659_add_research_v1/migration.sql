-- CreateEnum
CREATE TYPE "CompanyResearchStatus" AS ENUM ('LOCKED', 'AVAILABLE', 'RESEARCHING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ResearchJobStatus" AS ENUM ('RUNNING', 'COMPLETED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "LedgerEntryType" ADD VALUE 'RESEARCH_PAYMENT';

-- CreateTable
CREATE TABLE "CompanyRecipe" (
    "companyId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "isUnlocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyRecipe_pkey" PRIMARY KEY ("companyId","recipeId")
);

-- CreateTable
CREATE TABLE "ResearchNode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "costCashCents" BIGINT NOT NULL,
    "durationTicks" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchNodeUnlockRecipe" (
    "nodeId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,

    CONSTRAINT "ResearchNodeUnlockRecipe_pkey" PRIMARY KEY ("nodeId","recipeId")
);

-- CreateTable
CREATE TABLE "ResearchPrerequisite" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "prerequisiteNodeId" TEXT NOT NULL,

    CONSTRAINT "ResearchPrerequisite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyResearch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "status" "CompanyResearchStatus" NOT NULL DEFAULT 'LOCKED',
    "tickStarted" INTEGER,
    "tickCompletes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyResearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchJob" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "status" "ResearchJobStatus" NOT NULL DEFAULT 'RUNNING',
    "costCashCents" BIGINT NOT NULL,
    "tickStarted" INTEGER NOT NULL,
    "tickCompletes" INTEGER NOT NULL,
    "tickClosed" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyRecipe_companyId_isUnlocked_idx" ON "CompanyRecipe"("companyId", "isUnlocked");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchNode_code_key" ON "ResearchNode"("code");

-- CreateIndex
CREATE INDEX "ResearchNodeUnlockRecipe_recipeId_idx" ON "ResearchNodeUnlockRecipe"("recipeId");

-- CreateIndex
CREATE INDEX "ResearchPrerequisite_prerequisiteNodeId_idx" ON "ResearchPrerequisite"("prerequisiteNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchPrerequisite_nodeId_prerequisiteNodeId_key" ON "ResearchPrerequisite"("nodeId", "prerequisiteNodeId");

-- CreateIndex
CREATE INDEX "CompanyResearch_companyId_status_idx" ON "CompanyResearch"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyResearch_companyId_nodeId_key" ON "CompanyResearch"("companyId", "nodeId");

-- CreateIndex
CREATE INDEX "ResearchJob_companyId_status_idx" ON "ResearchJob"("companyId", "status");

-- CreateIndex
CREATE INDEX "ResearchJob_status_tickCompletes_idx" ON "ResearchJob"("status", "tickCompletes");

-- AddForeignKey
ALTER TABLE "CompanyRecipe" ADD CONSTRAINT "CompanyRecipe_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyRecipe" ADD CONSTRAINT "CompanyRecipe_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchNodeUnlockRecipe" ADD CONSTRAINT "ResearchNodeUnlockRecipe_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "ResearchNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchNodeUnlockRecipe" ADD CONSTRAINT "ResearchNodeUnlockRecipe_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchPrerequisite" ADD CONSTRAINT "ResearchPrerequisite_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "ResearchNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchPrerequisite" ADD CONSTRAINT "ResearchPrerequisite_prerequisiteNodeId_fkey" FOREIGN KEY ("prerequisiteNodeId") REFERENCES "ResearchNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyResearch" ADD CONSTRAINT "CompanyResearch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyResearch" ADD CONSTRAINT "CompanyResearch_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "ResearchNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchJob" ADD CONSTRAINT "ResearchJob_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchJob" ADD CONSTRAINT "ResearchJob_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "ResearchNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

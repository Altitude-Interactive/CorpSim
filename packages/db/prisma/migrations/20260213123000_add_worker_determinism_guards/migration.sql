CREATE TABLE "SimulationLease" (
  "name" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SimulationLease_pkey" PRIMARY KEY ("name")
);

CREATE INDEX "SimulationLease_expiresAt_idx" ON "SimulationLease"("expiresAt");

CREATE TABLE "SimulationTickExecution" (
  "executionKey" TEXT NOT NULL,
  "tickBefore" INTEGER NOT NULL,
  "tickAfter" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SimulationTickExecution_pkey" PRIMARY KEY ("executionKey")
);

CREATE INDEX "SimulationTickExecution_tickAfter_idx" ON "SimulationTickExecution"("tickAfter");

CREATE TABLE "SimulationControlState" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "botsPaused" BOOLEAN NOT NULL DEFAULT false,
  "processingStopped" BOOLEAN NOT NULL DEFAULT false,
  "lastInvariantViolationTick" INTEGER,
  "lastInvariantViolationAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SimulationControlState_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SimulationControlState_singleton_id_check" CHECK ("id" = 1)
);

INSERT INTO "SimulationControlState" ("id", "botsPaused", "processingStopped", "createdAt", "updatedAt")
VALUES (1, false, false, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

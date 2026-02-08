CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Player_handle_key" ON "Player"("handle");

ALTER TABLE "Company" ADD COLUMN "ownerPlayerId" TEXT;

CREATE INDEX "Company_ownerPlayerId_idx" ON "Company"("ownerPlayerId");

ALTER TABLE "Company"
ADD CONSTRAINT "Company_ownerPlayerId_fkey"
FOREIGN KEY ("ownerPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

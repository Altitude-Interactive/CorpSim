CREATE TABLE IF NOT EXISTS "MaintenanceState" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reason" TEXT NOT NULL DEFAULT 'Systems are currently being updated.',
  "enabledBy" TEXT,
  "scope" TEXT NOT NULL DEFAULT 'all',
  CONSTRAINT "MaintenanceState_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MaintenanceState_singleton_id_check" CHECK ("id" = 1),
  CONSTRAINT "MaintenanceState_scope_check" CHECK ("scope" IN ('all', 'web-only'))
);

INSERT INTO "MaintenanceState" ("id", "enabled", "updatedAt", "reason", "enabledBy", "scope")
VALUES (1, false, NOW(), 'Systems are currently being updated.', NULL, 'all')
ON CONFLICT ("id") DO NOTHING;

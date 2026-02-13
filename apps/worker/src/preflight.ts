import { Prisma, PrismaClient } from "@prisma/client";

const REQUIRED_DETERMINISM_TABLES = [
  "SimulationLease",
  "SimulationTickExecution",
  "SimulationControlState"
] as const;

export async function assertWorkerDeterminismSchemaReady(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{ table_name: string }>>(
    Prisma.sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name IN (${Prisma.join(REQUIRED_DETERMINISM_TABLES)})
    `
  );

  const existing = new Set(rows.map((entry) => entry.table_name));
  const missing = REQUIRED_DETERMINISM_TABLES.filter((table) => !existing.has(table));
  if (missing.length === 0) {
    return;
  }

  throw new Error(
    `worker determinism schema preflight failed: missing table(s): ${missing.join(", ")}. ` +
      "Apply migrations before starting the worker."
  );
}

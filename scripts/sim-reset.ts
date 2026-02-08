import { createPrismaClient } from "../packages/db/src/client";
import { seedWorld } from "../packages/db/src/seed-world";
import { resetSimulationData } from "../packages/sim/src/services/reset-simulation";

function shouldSeedWorld(args: string[]): boolean {
  return !args.includes("--no-seed");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const prisma = createPrismaClient();

  try {
    await resetSimulationData(prisma);

    if (shouldSeedWorld(args)) {
      await seedWorld(prisma, { reset: false });
    }

    console.log(`Simulation reset complete. Seeded: ${shouldSeedWorld(args)}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Simulation reset failed", error);
  process.exitCode = 1;
});

import { createPrismaClient, seedWorld } from "@corpsim/db";
import { resetSimulationData } from "@corpsim/sim";

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


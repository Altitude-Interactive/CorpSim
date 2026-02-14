import { createPrismaClient } from "./src/client";
import { seedWorld } from "./src/seed-world";

interface SeedCliOptions {
  reset: boolean;
}

function parseSeedCliOptions(args: string[]): SeedCliOptions {
  return {
    reset: args.includes("--reset")
  };
}

async function main(): Promise<void> {
  const options = parseSeedCliOptions(process.argv.slice(2));
  const prisma = createPrismaClient();

  try {
    const [companyCount, itemCount, worldTickState] = await prisma.$transaction([
      prisma.company.count(),
      prisma.item.count(),
      prisma.worldTickState.findUnique({ where: { id: 1 } })
    ]);

    const hasExistingData = companyCount > 0 || itemCount > 0;
    if (hasExistingData && !options.reset) {
      const tickText =
        typeof worldTickState?.currentTick === "number" ? worldTickState.currentTick.toString() : "unknown";
      console.log(
        `Seed skipped. Existing simulation data found (companies: ${companyCount}, items: ${itemCount}, tick: ${tickText}).`
      );
      console.log("Use --reset to wipe and reseed from scratch.");
      return;
    }

    const result = await seedWorld(prisma, { reset: options.reset });

    console.log(
      `Seed complete. Companies: ${Object.keys(result.companyIds).length}, Items: ${Object.keys(result.itemIds).length}, Reset: ${options.reset}`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Seed failed", error);
  process.exitCode = 1;
});

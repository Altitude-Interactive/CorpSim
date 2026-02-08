import { createPrismaClient } from "./src/client";
import { seedWorld } from "./src/seed-world";

async function main(): Promise<void> {
  const prisma = createPrismaClient();

  try {
    const result = await seedWorld(prisma, { reset: true });

    console.log(
      `Seed complete. Companies: ${Object.keys(result.companyIds).length}, Items: ${Object.keys(result.itemIds).length}`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Seed failed", error);
  process.exitCode = 1;
});

import { createPrismaClient, syncStaticCatalog } from "@corpsim/db";

async function main(): Promise<void> {
  const prisma = createPrismaClient();

  try {
    const result = await syncStaticCatalog(prisma);
    console.log(
      [
        "Static catalog sync complete.",
        `Items: ${result.itemsSynced}`,
        `Recipes: ${result.recipesSynced}`,
        `Research nodes: ${result.researchNodesSynced}`,
        `Prerequisites: ${result.prerequisitesSynced}`,
        `Company recipe links created: ${result.companyRecipeLinksCreated}`
      ].join(" ")
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Static catalog sync failed", error);
  process.exitCode = 1;
});

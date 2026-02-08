import { PrismaClient } from "@prisma/client";

export async function resetSimulationData(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.trade.deleteMany();
    await tx.marketOrder.deleteMany();
    await tx.productionJob.deleteMany();
    await tx.ledgerEntry.deleteMany();
    await tx.recipeInput.deleteMany();
    await tx.recipe.deleteMany();
    await tx.inventory.deleteMany();
    await tx.company.deleteMany();
    await tx.item.deleteMany();
    await tx.worldTickState.deleteMany();

    await tx.worldTickState.create({
      data: {
        id: 1,
        currentTick: 0,
        lockVersion: 0,
        lastAdvancedAt: null
      }
    });
  });
}

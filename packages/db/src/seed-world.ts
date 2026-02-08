import { OrderSide, PrismaClient, ProductionJobStatus } from "@prisma/client";
import { placeMarketOrder } from "../../sim/src/services/market-orders";
import { resetSimulationData } from "../../sim/src/services/reset-simulation";

export interface SeedWorldOptions {
  reset?: boolean;
}

export interface SeedWorldResult {
  companyIds: Record<string, string>;
  itemIds: Record<string, string>;
}

export async function seedWorld(
  prisma: PrismaClient,
  options: SeedWorldOptions = {}
): Promise<SeedWorldResult> {
  if (options.reset) {
    await resetSimulationData(prisma);
  }

  const ironOre = await prisma.item.create({
    data: {
      code: "IRON_ORE",
      name: "Iron Ore"
    }
  });

  const ironIngot = await prisma.item.create({
    data: {
      code: "IRON_INGOT",
      name: "Iron Ingot"
    }
  });

  const handTools = await prisma.item.create({
    data: {
      code: "HAND_TOOLS",
      name: "Hand Tools"
    }
  });

  const playerCompany = await prisma.company.create({
    data: {
      code: "PLAYER_CO",
      name: "Player Company",
      isPlayer: true,
      cashCents: 1_000_000n,
      reservedCashCents: 0n
    }
  });

  const botMiner = await prisma.company.create({
    data: {
      code: "BOT_MINER",
      name: "Atlas Mining Co",
      isPlayer: false,
      cashCents: 800_000n,
      reservedCashCents: 0n
    }
  });

  const botSmelter = await prisma.company.create({
    data: {
      code: "BOT_SMELTER",
      name: "Northwind Smelting",
      isPlayer: false,
      cashCents: 800_000n,
      reservedCashCents: 0n
    }
  });

  const botTrader = await prisma.company.create({
    data: {
      code: "BOT_TRADER",
      name: "Summit Trading",
      isPlayer: false,
      cashCents: 800_000n,
      reservedCashCents: 0n
    }
  });

  await prisma.inventory.createMany({
    data: [
      {
        companyId: playerCompany.id,
        itemId: ironOre.id,
        quantity: 120,
        reservedQuantity: 0
      },
      {
        companyId: playerCompany.id,
        itemId: ironIngot.id,
        quantity: 40,
        reservedQuantity: 0
      },
      {
        companyId: botMiner.id,
        itemId: ironOre.id,
        quantity: 500,
        reservedQuantity: 0
      },
      {
        companyId: botSmelter.id,
        itemId: ironIngot.id,
        quantity: 220,
        reservedQuantity: 0
      },
      {
        companyId: botTrader.id,
        itemId: handTools.id,
        quantity: 80,
        reservedQuantity: 0
      }
    ]
  });

  const smeltRecipe = await prisma.recipe.create({
    data: {
      code: "SMELT_IRON",
      name: "Smelt Iron",
      durationTicks: 2,
      outputItemId: ironIngot.id,
      outputQuantity: 1,
      inputs: {
        create: [{ itemId: ironOre.id, quantity: 2 }]
      }
    }
  });

  const toolRecipe = await prisma.recipe.create({
    data: {
      code: "ASSEMBLE_TOOLS",
      name: "Assemble Tools",
      durationTicks: 3,
      outputItemId: handTools.id,
      outputQuantity: 1,
      inputs: {
        create: [{ itemId: ironIngot.id, quantity: 3 }]
      }
    }
  });

  await prisma.productionJob.createMany({
    data: [
      {
        companyId: botSmelter.id,
        recipeId: smeltRecipe.id,
        status: ProductionJobStatus.IN_PROGRESS,
        runs: 20,
        startedTick: 0,
        dueTick: 2
      },
      {
        companyId: botTrader.id,
        recipeId: toolRecipe.id,
        status: ProductionJobStatus.IN_PROGRESS,
        runs: 10,
        startedTick: 0,
        dueTick: 3
      }
    ]
  });

  await placeMarketOrder(prisma, {
    companyId: botMiner.id,
    itemId: ironOre.id,
    side: OrderSide.SELL,
    quantity: 100,
    unitPriceCents: 80n,
    tick: 0
  });

  await placeMarketOrder(prisma, {
    companyId: botTrader.id,
    itemId: ironIngot.id,
    side: OrderSide.BUY,
    quantity: 60,
    unitPriceCents: 210n,
    tick: 0
  });

  await prisma.worldTickState.upsert({
    where: { id: 1 },
    update: {
      currentTick: 0,
      lockVersion: 0,
      lastAdvancedAt: null
    },
    create: {
      id: 1,
      currentTick: 0,
      lockVersion: 0,
      lastAdvancedAt: null
    }
  });

  return {
    companyIds: {
      player: playerCompany.id,
      botMiner: botMiner.id,
      botSmelter: botSmelter.id,
      botTrader: botTrader.id
    },
    itemIds: {
      ironOre: ironOre.id,
      ironIngot: ironIngot.id,
      handTools: handTools.id
    }
  };
}

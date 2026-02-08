import { OrderSide, PrismaClient } from "@prisma/client";
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

  const steelIngot = await prisma.item.create({
    data: {
      code: "STEEL_INGOT",
      name: "Steel Ingot"
    }
  });

  const machineParts = await prisma.item.create({
    data: {
      code: "MACHINE_PARTS",
      name: "Machine Parts"
    }
  });

  const toolKit = await prisma.item.create({
    data: {
      code: "TOOL_KIT",
      name: "Tool Kit"
    }
  });

  const player = await prisma.player.create({
    data: {
      handle: "PLAYER"
    }
  });

  const playerCompany = await prisma.company.create({
    data: {
      code: "PLAYER_CO",
      name: "Player Company",
      isPlayer: true,
      ownerPlayerId: player.id,
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
      },
      {
        companyId: playerCompany.id,
        itemId: steelIngot.id,
        quantity: 0,
        reservedQuantity: 0
      },
      {
        companyId: playerCompany.id,
        itemId: machineParts.id,
        quantity: 0,
        reservedQuantity: 0
      },
      {
        companyId: playerCompany.id,
        itemId: toolKit.id,
        quantity: 0,
        reservedQuantity: 0
      }
    ]
  });

  const smeltIron = await prisma.recipe.create({
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

  const assembleTools = await prisma.recipe.create({
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

  const smeltSteel = await prisma.recipe.create({
    data: {
      code: "SMELT_STEEL",
      name: "Smelt Steel",
      durationTicks: 3,
      outputItemId: steelIngot.id,
      outputQuantity: 1,
      inputs: {
        create: [{ itemId: ironIngot.id, quantity: 2 }]
      }
    }
  });

  const machinePartsRecipe = await prisma.recipe.create({
    data: {
      code: "MACHINE_PARTS",
      name: "Assemble Machine Parts",
      durationTicks: 4,
      outputItemId: machineParts.id,
      outputQuantity: 1,
      inputs: {
        create: [
          { itemId: steelIngot.id, quantity: 2 },
          { itemId: handTools.id, quantity: 1 }
        ]
      }
    }
  });

  const assembleKits = await prisma.recipe.create({
    data: {
      code: "ASSEMBLE_KITS",
      name: "Assemble Tool Kits",
      durationTicks: 4,
      outputItemId: toolKit.id,
      outputQuantity: 1,
      inputs: {
        create: [
          { itemId: handTools.id, quantity: 2 },
          { itemId: machineParts.id, quantity: 1 }
        ]
      }
    }
  });

  const companies = [playerCompany, botMiner, botSmelter, botTrader];
  const recipes = [smeltIron, assembleTools, smeltSteel, machinePartsRecipe, assembleKits];

  for (const company of companies) {
    await prisma.companyRecipe.createMany({
      data: recipes.map((recipe) => ({
        companyId: company.id,
        recipeId: recipe.id,
        // Starter set available for all companies; advanced recipes unlock via research.
        isUnlocked: recipe.code === "SMELT_IRON"
      }))
    });
  }

  const basicsNode = await prisma.researchNode.create({
    data: {
      code: "BASICS",
      name: "Basics",
      description: "Foundational operating procedures and starter smelting methods.",
      costCashCents: 0n,
      durationTicks: 0,
      unlockRecipes: {
        create: [{ recipeId: smeltIron.id }]
      }
    }
  });

  const metalworkingNode = await prisma.researchNode.create({
    data: {
      code: "METALWORKING",
      name: "Metalworking",
      description: "Unlocks intermediate assembly of forged parts and hand tools.",
      costCashCents: 50_000n,
      durationTicks: 3,
      unlockRecipes: {
        create: [{ recipeId: assembleTools.id }]
      }
    }
  });

  const steelNode = await prisma.researchNode.create({
    data: {
      code: "STEEL_PROCESSING",
      name: "Steel Processing",
      description: "Enables conversion of refined iron into higher-grade steel.",
      costCashCents: 75_000n,
      durationTicks: 4,
      unlockRecipes: {
        create: [{ recipeId: smeltSteel.id }]
      }
    }
  });

  const precisionNode = await prisma.researchNode.create({
    data: {
      code: "PRECISION_MANUFACTURING",
      name: "Precision Manufacturing",
      description: "Combines tool and steel workflows for advanced component assembly.",
      costCashCents: 140_000n,
      durationTicks: 5,
      unlockRecipes: {
        create: [{ recipeId: machinePartsRecipe.id }]
      }
    }
  });

  const industrialNode = await prisma.researchNode.create({
    data: {
      code: "INDUSTRIAL_LOGISTICS",
      name: "Industrial Logistics",
      description: "Final-stage packaging and assembly workflows for tool kits.",
      costCashCents: 180_000n,
      durationTicks: 6,
      unlockRecipes: {
        create: [{ recipeId: assembleKits.id }]
      }
    }
  });

  await prisma.researchPrerequisite.createMany({
    data: [
      { nodeId: metalworkingNode.id, prerequisiteNodeId: basicsNode.id },
      { nodeId: steelNode.id, prerequisiteNodeId: basicsNode.id },
      { nodeId: precisionNode.id, prerequisiteNodeId: metalworkingNode.id },
      { nodeId: precisionNode.id, prerequisiteNodeId: steelNode.id },
      { nodeId: industrialNode.id, prerequisiteNodeId: precisionNode.id }
    ]
  });

  await prisma.companyResearch.create({
    data: {
      companyId: playerCompany.id,
      nodeId: basicsNode.id,
      status: "COMPLETED",
      tickStarted: 0,
      tickCompletes: 0
    }
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
      handTools: handTools.id,
      steelIngot: steelIngot.id,
      machineParts: machineParts.id,
      toolKit: toolKit.id
    }
  };
}

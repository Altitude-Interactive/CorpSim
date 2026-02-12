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

const ITEM_DEFINITIONS = [
  { key: "ironOre", code: "IRON_ORE", name: "Iron Ore" },
  { key: "coal", code: "COAL", name: "Coal" },
  { key: "copperOre", code: "COPPER_ORE", name: "Copper Ore" },
  { key: "ironIngot", code: "IRON_INGOT", name: "Iron Ingot" },
  { key: "copperIngot", code: "COPPER_INGOT", name: "Copper Ingot" },
  { key: "handTools", code: "HAND_TOOLS", name: "Hand Tools" },
  { key: "steelIngot", code: "STEEL_INGOT", name: "Steel Ingot" },
  { key: "steelBeam", code: "STEEL_BEAM", name: "Steel Beam" },
  { key: "fasteners", code: "FASTENERS", name: "Fasteners" },
  { key: "machineParts", code: "MACHINE_PARTS", name: "Machine Parts" },
  { key: "toolKit", code: "TOOL_KIT", name: "Tool Kit" },
  { key: "powerUnit", code: "POWER_UNIT", name: "Power Unit" },
  { key: "conveyorModule", code: "CONVEYOR_MODULE", name: "Conveyor Module" },
  { key: "industrialPress", code: "INDUSTRIAL_PRESS", name: "Industrial Press" }
] as const;

type ItemKey = (typeof ITEM_DEFINITIONS)[number]["key"];

const RECIPE_DEFINITIONS = [
  {
    key: "smeltIron",
    code: "SMELT_IRON",
    name: "Smelt Iron",
    durationTicks: 2,
    outputItemKey: "ironIngot",
    outputQuantity: 1,
    inputs: [{ itemKey: "ironOre", quantity: 2 }]
  },
  {
    key: "smeltCopper",
    code: "SMELT_COPPER",
    name: "Smelt Copper",
    durationTicks: 3,
    outputItemKey: "copperIngot",
    outputQuantity: 1,
    inputs: [
      { itemKey: "copperOre", quantity: 2 },
      { itemKey: "coal", quantity: 1 }
    ]
  },
  {
    key: "assembleTools",
    code: "ASSEMBLE_TOOLS",
    name: "Assemble Tools",
    durationTicks: 3,
    outputItemKey: "handTools",
    outputQuantity: 1,
    inputs: [{ itemKey: "ironIngot", quantity: 3 }]
  },
  {
    key: "smeltSteel",
    code: "SMELT_STEEL",
    name: "Smelt Steel",
    durationTicks: 3,
    outputItemKey: "steelIngot",
    outputQuantity: 1,
    inputs: [
      { itemKey: "ironIngot", quantity: 2 },
      { itemKey: "coal", quantity: 1 }
    ]
  },
  {
    key: "forgeSteelBeam",
    code: "FORGE_STEEL_BEAM",
    name: "Forge Steel Beam",
    durationTicks: 4,
    outputItemKey: "steelBeam",
    outputQuantity: 1,
    inputs: [
      { itemKey: "steelIngot", quantity: 2 },
      { itemKey: "coal", quantity: 1 }
    ]
  },
  {
    key: "assembleFasteners",
    code: "ASSEMBLE_FASTENERS",
    name: "Assemble Fasteners",
    durationTicks: 2,
    outputItemKey: "fasteners",
    outputQuantity: 4,
    inputs: [
      { itemKey: "ironIngot", quantity: 1 },
      { itemKey: "copperIngot", quantity: 1 }
    ]
  },
  {
    key: "machineParts",
    code: "MACHINE_PARTS",
    name: "Assemble Machine Parts",
    durationTicks: 4,
    outputItemKey: "machineParts",
    outputQuantity: 1,
    inputs: [
      { itemKey: "steelIngot", quantity: 2 },
      { itemKey: "handTools", quantity: 1 }
    ]
  },
  {
    key: "assembleKits",
    code: "ASSEMBLE_KITS",
    name: "Assemble Tool Kits",
    durationTicks: 4,
    outputItemKey: "toolKit",
    outputQuantity: 1,
    inputs: [
      { itemKey: "handTools", quantity: 2 },
      { itemKey: "machineParts", quantity: 1 }
    ]
  },
  {
    key: "assemblePowerUnit",
    code: "ASSEMBLE_POWER_UNIT",
    name: "Assemble Power Unit",
    durationTicks: 5,
    outputItemKey: "powerUnit",
    outputQuantity: 1,
    inputs: [
      { itemKey: "copperIngot", quantity: 2 },
      { itemKey: "steelIngot", quantity: 1 },
      { itemKey: "machineParts", quantity: 1 }
    ]
  },
  {
    key: "assembleConveyorModule",
    code: "ASSEMBLE_CONVEYOR_MODULE",
    name: "Assemble Conveyor Module",
    durationTicks: 6,
    outputItemKey: "conveyorModule",
    outputQuantity: 1,
    inputs: [
      { itemKey: "steelBeam", quantity: 2 },
      { itemKey: "fasteners", quantity: 4 },
      { itemKey: "machineParts", quantity: 1 }
    ]
  },
  {
    key: "buildIndustrialPress",
    code: "BUILD_INDUSTRIAL_PRESS",
    name: "Build Industrial Press",
    durationTicks: 8,
    outputItemKey: "industrialPress",
    outputQuantity: 1,
    inputs: [
      { itemKey: "powerUnit", quantity: 1 },
      { itemKey: "conveyorModule", quantity: 1 },
      { itemKey: "toolKit", quantity: 1 },
      { itemKey: "fasteners", quantity: 6 }
    ]
  }
] as const;

type RecipeKey = (typeof RECIPE_DEFINITIONS)[number]["key"];

const RESEARCH_DEFINITIONS = [
  {
    key: "basics",
    code: "BASICS",
    name: "Basics",
    description: "Foundational operations, ore handling, and starter smelting methods.",
    costCashCents: 0n,
    durationTicks: 0,
    unlockRecipeKeys: ["smeltIron", "smeltCopper"]
  },
  {
    key: "metalworking",
    code: "METALWORKING",
    name: "Metalworking",
    description: "Unlocks practical fabrication methods for hand tool production.",
    costCashCents: 55_000n,
    durationTicks: 3,
    unlockRecipeKeys: ["assembleTools"]
  },
  {
    key: "steelProcessing",
    code: "STEEL_PROCESSING",
    name: "Steel Processing",
    description: "Enables carbon-assisted smelting and stronger steel outputs.",
    costCashCents: 85_000n,
    durationTicks: 4,
    unlockRecipeKeys: ["smeltSteel", "assembleFasteners"]
  },
  {
    key: "structuralFabrication",
    code: "STRUCTURAL_FABRICATION",
    name: "Structural Fabrication",
    description: "Allows beam forging and heavy structural component workflows.",
    costCashCents: 120_000n,
    durationTicks: 5,
    unlockRecipeKeys: ["forgeSteelBeam"]
  },
  {
    key: "precisionManufacturing",
    code: "PRECISION_MANUFACTURING",
    name: "Precision Manufacturing",
    description: "Combines steel and tooling workflows into precision components.",
    costCashCents: 150_000n,
    durationTicks: 5,
    unlockRecipeKeys: ["machineParts"]
  },
  {
    key: "industrialLogistics",
    code: "INDUSTRIAL_LOGISTICS",
    name: "Industrial Logistics",
    description: "Unlocks scalable packaging and coordinated kit assembly methods.",
    costCashCents: 180_000n,
    durationTicks: 6,
    unlockRecipeKeys: ["assembleKits"]
  },
  {
    key: "powerSystems",
    code: "POWER_SYSTEMS",
    name: "Power Systems",
    description: "Introduces integrated electromechanical power unit design.",
    costCashCents: 220_000n,
    durationTicks: 6,
    unlockRecipeKeys: ["assemblePowerUnit"]
  },
  {
    key: "automationLines",
    code: "AUTOMATION_LINES",
    name: "Automation Lines",
    description: "Adds modular conveyor assembly for repeatable factory throughput.",
    costCashCents: 260_000n,
    durationTicks: 7,
    unlockRecipeKeys: ["assembleConveyorModule"]
  },
  {
    key: "heavyIndustry",
    code: "HEAVY_INDUSTRY",
    name: "Heavy Industry",
    description: "Final-stage system integration for complete industrial press builds.",
    costCashCents: 320_000n,
    durationTicks: 8,
    unlockRecipeKeys: ["buildIndustrialPress"]
  }
] as const satisfies ReadonlyArray<{
  key: string;
  code: string;
  name: string;
  description: string;
  costCashCents: bigint;
  durationTicks: number;
  unlockRecipeKeys: readonly RecipeKey[];
}>;

type ResearchKey = (typeof RESEARCH_DEFINITIONS)[number]["key"];

const RESEARCH_PREREQUISITES: ReadonlyArray<{
  nodeKey: ResearchKey;
  prerequisiteKey: ResearchKey;
}> = [
  { nodeKey: "metalworking", prerequisiteKey: "basics" },
  { nodeKey: "steelProcessing", prerequisiteKey: "basics" },
  { nodeKey: "structuralFabrication", prerequisiteKey: "steelProcessing" },
  { nodeKey: "precisionManufacturing", prerequisiteKey: "metalworking" },
  { nodeKey: "precisionManufacturing", prerequisiteKey: "steelProcessing" },
  { nodeKey: "industrialLogistics", prerequisiteKey: "precisionManufacturing" },
  { nodeKey: "powerSystems", prerequisiteKey: "precisionManufacturing" },
  { nodeKey: "automationLines", prerequisiteKey: "structuralFabrication" },
  { nodeKey: "automationLines", prerequisiteKey: "industrialLogistics" },
  { nodeKey: "heavyIndustry", prerequisiteKey: "powerSystems" },
  { nodeKey: "heavyIndustry", prerequisiteKey: "automationLines" }
];

export async function seedWorld(
  prisma: PrismaClient,
  options: SeedWorldOptions = {}
): Promise<SeedWorldResult> {
  if (options.reset) {
    await resetSimulationData(prisma);
  }

  const itemsByKey = {} as Record<
    ItemKey,
    {
      id: string;
      code: string;
      name: string;
    }
  >;
  for (const definition of ITEM_DEFINITIONS) {
    const item = await prisma.item.create({
      data: {
        code: definition.code,
        name: definition.name
      }
    });
    itemsByKey[definition.key] = item;
  }

  const player = await prisma.player.create({
    data: {
      handle: "PLAYER"
    }
  });

  const coreRegion = await prisma.region.upsert({
    where: { code: "CORE" },
    update: { name: "Core" },
    create: {
      id: "region_core",
      code: "CORE",
      name: "Core"
    }
  });

  await prisma.region.upsert({
    where: { code: "INDUSTRIAL" },
    update: { name: "Industrial" },
    create: {
      id: "region_industrial",
      code: "INDUSTRIAL",
      name: "Industrial"
    }
  });

  await prisma.region.upsert({
    where: { code: "FRONTIER" },
    update: { name: "Frontier" },
    create: {
      id: "region_frontier",
      code: "FRONTIER",
      name: "Frontier"
    }
  });

  const playerCompany = await prisma.company.create({
    data: {
      code: "PLAYER_CO",
      name: "Player Company",
      isPlayer: true,
      ownerPlayerId: player.id,
      regionId: coreRegion.id,
      cashCents: 1_200_000n,
      reservedCashCents: 0n
    }
  });

  const botMiner = await prisma.company.create({
    data: {
      code: "BOT_MINER",
      name: "Atlas Mining Co",
      isPlayer: false,
      regionId: coreRegion.id,
      cashCents: 1_000_000n,
      reservedCashCents: 0n
    }
  });

  const botSmelter = await prisma.company.create({
    data: {
      code: "BOT_SMELTER",
      name: "Northwind Smelting",
      isPlayer: false,
      regionId: coreRegion.id,
      cashCents: 1_000_000n,
      reservedCashCents: 0n
    }
  });

  const botTrader = await prisma.company.create({
    data: {
      code: "BOT_TRADER",
      name: "Summit Trading",
      isPlayer: false,
      regionId: coreRegion.id,
      cashCents: 1_000_000n,
      reservedCashCents: 0n
    }
  });

  const inventoryRows: Array<{
    companyId: string;
    itemKey: ItemKey;
    quantity: number;
    reservedQuantity?: number;
  }> = [
    { companyId: playerCompany.id, itemKey: "ironOre", quantity: 240 },
    { companyId: playerCompany.id, itemKey: "coal", quantity: 140 },
    { companyId: playerCompany.id, itemKey: "copperOre", quantity: 180 },
    { companyId: playerCompany.id, itemKey: "ironIngot", quantity: 12 },
    { companyId: playerCompany.id, itemKey: "copperIngot", quantity: 6 },
    { companyId: playerCompany.id, itemKey: "handTools", quantity: 0 },
    { companyId: playerCompany.id, itemKey: "steelIngot", quantity: 0 },
    { companyId: playerCompany.id, itemKey: "steelBeam", quantity: 0 },
    { companyId: playerCompany.id, itemKey: "fasteners", quantity: 0 },
    { companyId: playerCompany.id, itemKey: "machineParts", quantity: 0 },
    { companyId: playerCompany.id, itemKey: "toolKit", quantity: 0 },
    { companyId: playerCompany.id, itemKey: "powerUnit", quantity: 0 },
    { companyId: playerCompany.id, itemKey: "conveyorModule", quantity: 0 },
    { companyId: playerCompany.id, itemKey: "industrialPress", quantity: 0 },

    { companyId: botMiner.id, itemKey: "ironOre", quantity: 700 },
    { companyId: botMiner.id, itemKey: "coal", quantity: 650 },
    { companyId: botMiner.id, itemKey: "copperOre", quantity: 520 },

    { companyId: botSmelter.id, itemKey: "ironIngot", quantity: 320 },
    { companyId: botSmelter.id, itemKey: "copperIngot", quantity: 220 },
    { companyId: botSmelter.id, itemKey: "steelIngot", quantity: 180 },
    { companyId: botSmelter.id, itemKey: "fasteners", quantity: 300 },
    { companyId: botSmelter.id, itemKey: "steelBeam", quantity: 70 },

    { companyId: botTrader.id, itemKey: "handTools", quantity: 140 },
    { companyId: botTrader.id, itemKey: "machineParts", quantity: 70 },
    { companyId: botTrader.id, itemKey: "toolKit", quantity: 36 },
    { companyId: botTrader.id, itemKey: "powerUnit", quantity: 16 },
    { companyId: botTrader.id, itemKey: "conveyorModule", quantity: 10 },
    { companyId: botTrader.id, itemKey: "industrialPress", quantity: 2 }
  ];

  await prisma.inventory.createMany({
    data: inventoryRows.map((row) => ({
      companyId: row.companyId,
      itemId: itemsByKey[row.itemKey].id,
      regionId: coreRegion.id,
      quantity: row.quantity,
      reservedQuantity: row.reservedQuantity ?? 0
    }))
  });

  const recipesByKey = {} as Record<
    RecipeKey,
    {
      id: string;
      code: string;
    }
  >;
  for (const definition of RECIPE_DEFINITIONS) {
    const recipe = await prisma.recipe.create({
      data: {
        code: definition.code,
        name: definition.name,
        durationTicks: definition.durationTicks,
        outputItemId: itemsByKey[definition.outputItemKey].id,
        outputQuantity: definition.outputQuantity,
        inputs: {
          create: definition.inputs.map((input) => ({
            itemId: itemsByKey[input.itemKey].id,
            quantity: input.quantity
          }))
        }
      }
    });
    recipesByKey[definition.key] = recipe;
  }

  const companies = [playerCompany, botMiner, botSmelter, botTrader];
  const starterRecipeCodes = new Set(["SMELT_IRON", "SMELT_COPPER"]);
  const allRecipes = Object.values(recipesByKey);

  for (const company of companies) {
    await prisma.companyRecipe.createMany({
      data: allRecipes.map((recipe) => ({
        companyId: company.id,
        recipeId: recipe.id,
        isUnlocked: starterRecipeCodes.has(recipe.code)
      }))
    });
  }

  const researchNodesByKey = {} as Record<
    ResearchKey,
    {
      id: string;
      code: string;
    }
  >;
  for (const definition of RESEARCH_DEFINITIONS) {
    const node = await prisma.researchNode.create({
      data: {
        code: definition.code,
        name: definition.name,
        description: definition.description,
        costCashCents: definition.costCashCents,
        durationTicks: definition.durationTicks,
        unlockRecipes: {
          create: definition.unlockRecipeKeys.map((recipeKey) => ({
            recipeId: recipesByKey[recipeKey].id
          }))
        }
      }
    });
    researchNodesByKey[definition.key] = node;
  }

  await prisma.researchPrerequisite.createMany({
    data: RESEARCH_PREREQUISITES.map((entry) => ({
      nodeId: researchNodesByKey[entry.nodeKey].id,
      prerequisiteNodeId: researchNodesByKey[entry.prerequisiteKey].id
    }))
  });

  await prisma.companyResearch.create({
    data: {
      companyId: playerCompany.id,
      nodeId: researchNodesByKey.basics.id,
      status: "COMPLETED",
      tickStarted: 0,
      tickCompletes: 0
    }
  });

  const marketSeedOrders: Array<{
    companyId: string;
    itemKey: ItemKey;
    side: OrderSide;
    quantity: number;
    unitPriceCents: bigint;
  }> = [
    {
      companyId: botMiner.id,
      itemKey: "ironOre",
      side: OrderSide.SELL,
      quantity: 180,
      unitPriceCents: 80n
    },
    {
      companyId: botMiner.id,
      itemKey: "coal",
      side: OrderSide.SELL,
      quantity: 180,
      unitPriceCents: 55n
    },
    {
      companyId: botMiner.id,
      itemKey: "copperOre",
      side: OrderSide.SELL,
      quantity: 120,
      unitPriceCents: 95n
    },
    {
      companyId: botSmelter.id,
      itemKey: "ironIngot",
      side: OrderSide.SELL,
      quantity: 90,
      unitPriceCents: 205n
    },
    {
      companyId: botSmelter.id,
      itemKey: "copperIngot",
      side: OrderSide.SELL,
      quantity: 70,
      unitPriceCents: 245n
    },
    {
      companyId: botSmelter.id,
      itemKey: "steelIngot",
      side: OrderSide.SELL,
      quantity: 60,
      unitPriceCents: 430n
    },
    {
      companyId: botSmelter.id,
      itemKey: "fasteners",
      side: OrderSide.SELL,
      quantity: 160,
      unitPriceCents: 150n
    },
    {
      companyId: botTrader.id,
      itemKey: "handTools",
      side: OrderSide.SELL,
      quantity: 40,
      unitPriceCents: 360n
    },
    {
      companyId: botTrader.id,
      itemKey: "machineParts",
      side: OrderSide.BUY,
      quantity: 40,
      unitPriceCents: 1_250n
    },
    {
      companyId: botTrader.id,
      itemKey: "toolKit",
      side: OrderSide.BUY,
      quantity: 24,
      unitPriceCents: 2_100n
    },
    {
      companyId: botTrader.id,
      itemKey: "powerUnit",
      side: OrderSide.BUY,
      quantity: 12,
      unitPriceCents: 2_550n
    },
    {
      companyId: botTrader.id,
      itemKey: "conveyorModule",
      side: OrderSide.BUY,
      quantity: 10,
      unitPriceCents: 4_250n
    },
    {
      companyId: botTrader.id,
      itemKey: "industrialPress",
      side: OrderSide.BUY,
      quantity: 4,
      unitPriceCents: 11_500n
    }
  ];

  for (const order of marketSeedOrders) {
    await placeMarketOrder(prisma, {
      companyId: order.companyId,
      itemId: itemsByKey[order.itemKey].id,
      side: order.side,
      quantity: order.quantity,
      unitPriceCents: order.unitPriceCents,
      tick: 0
    });
  }

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
    itemIds: Object.fromEntries(
      ITEM_DEFINITIONS.map((definition) => [definition.key, itemsByKey[definition.key].id])
    )
  };
}

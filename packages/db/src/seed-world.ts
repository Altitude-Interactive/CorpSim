import { buildIconCatalogItems, ICON_PACK_DEFINITIONS, resolveIconItemKey } from "@corpsim/shared";
import { OrderSide, PrismaClient } from "@prisma/client";
import { placeMarketOrder } from "@corpsim/sim";
import { resetSimulationData } from "@corpsim/sim";

export interface SeedWorldOptions {
  reset?: boolean;
}

export interface SeedWorldResult {
  companyIds: Record<string, string>;
  itemIds: Record<string, string>;
}

interface ItemDefinition {
  key: string;
  code: string;
  name: string;
  series?: number;
  index?: number;
  tier?: number;
  isFinalTier?: boolean;
  basePriceCents?: bigint;
}

interface RecipeDefinition {
  key: string;
  code: string;
  name: string;
  durationTicks: number;
  outputItemKey: string;
  outputQuantity: number;
  inputs: Array<{
    itemKey: string;
    quantity: number;
  }>;
}

interface ResearchDefinition {
  key: string;
  code: string;
  name: string;
  description: string;
  costCashCents: bigint;
  durationTicks: number;
  unlockRecipeKeys: string[];
}

const BASE_ITEM_DEFINITIONS: ItemDefinition[] = [
  { key: "ironOre", code: "IRON_ORE", name: "Scrap Metal" },
  { key: "coal", code: "COAL", name: "Polymer Sheet" },
  { key: "copperOre", code: "COPPER_ORE", name: "Copper Spool" },
  { key: "ironIngot", code: "IRON_INGOT", name: "Steel Tube" },
  { key: "copperIngot", code: "COPPER_INGOT", name: "Copper Cable" },
  { key: "handTools", code: "HAND_TOOLS", name: "Wrench Set" },
  { key: "steelIngot", code: "STEEL_INGOT", name: "Spring Steel" },
  { key: "steelBeam", code: "STEEL_BEAM", name: "Rail Segment" },
  { key: "fasteners", code: "FASTENERS", name: "Bolt Kit" },
  { key: "machineParts", code: "MACHINE_PARTS", name: "Control Board" },
  { key: "toolKit", code: "TOOL_KIT", name: "Maintenance Kit" },
  { key: "powerUnit", code: "POWER_UNIT", name: "Battery Module" },
  { key: "conveyorModule", code: "CONVEYOR_MODULE", name: "Roller Module" },
  { key: "industrialPress", code: "INDUSTRIAL_PRESS", name: "Press Chassis" },
  { key: "syntheticConduit", code: "SYNTHETIC_CONDUIT", name: "Synthetic Conduit" },
  { key: "biocellCanister", code: "BIOCELL_CANISTER", name: "Biocell Canister" },
  { key: "servoDrive", code: "SERVO_DRIVE", name: "Servo Drive" },
  { key: "opticModule", code: "OPTIC_MODULE", name: "Optic Module" },
  { key: "neuralInterface", code: "NEURAL_INTERFACE", name: "Neural Interface" },
  { key: "ocularImplant", code: "OCULAR_IMPLANT", name: "Ocular Implant" },
  { key: "cyberArmature", code: "CYBER_ARMATURE", name: "Cyber Armature" },
  { key: "spinalLink", code: "SPINAL_LINK", name: "Spinal Link" },
  { key: "cyberneticSuite", code: "CYBERNETIC_SUITE", name: "Cybernetic Suite" }
];

const BASE_RECIPE_DEFINITIONS: RecipeDefinition[] = [
  {
    key: "smeltIron",
    code: "SMELT_IRON",
    name: "Refine Steel Tubes",
    durationTicks: 2,
    outputItemKey: "ironIngot",
    outputQuantity: 1,
    inputs: [{ itemKey: "ironOre", quantity: 2 }]
  },
  {
    key: "smeltCopper",
    code: "SMELT_COPPER",
    name: "Draw Copper Cable",
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
    name: "Assemble Wrench Sets",
    durationTicks: 3,
    outputItemKey: "handTools",
    outputQuantity: 1,
    inputs: [{ itemKey: "ironIngot", quantity: 3 }]
  },
  {
    key: "smeltSteel",
    code: "SMELT_STEEL",
    name: "Temper Spring Steel",
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
    name: "Machine Rail Segments",
    durationTicks: 4,
    outputItemKey: "steelBeam",
    outputQuantity: 1,
    inputs: [
      { itemKey: "steelIngot", quantity: 2 },
      { itemKey: "ironIngot", quantity: 1 }
    ]
  },
  {
    key: "assembleFasteners",
    code: "ASSEMBLE_FASTENERS",
    name: "Pack Bolt Kits",
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
    name: "Etch Control Boards",
    durationTicks: 4,
    outputItemKey: "machineParts",
    outputQuantity: 1,
    inputs: [
      { itemKey: "steelIngot", quantity: 1 },
      { itemKey: "copperIngot", quantity: 2 },
      { itemKey: "handTools", quantity: 1 }
    ]
  },
  {
    key: "assembleKits",
    code: "ASSEMBLE_KITS",
    name: "Assemble Maintenance Kits",
    durationTicks: 3,
    outputItemKey: "toolKit",
    outputQuantity: 1,
    inputs: [
      { itemKey: "handTools", quantity: 1 },
      { itemKey: "machineParts", quantity: 1 }
    ]
  },
  {
    key: "assemblePowerUnit",
    code: "ASSEMBLE_POWER_UNIT",
    name: "Assemble Battery Modules",
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
    name: "Assemble Roller Modules",
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
    name: "Build Press Chassis",
    durationTicks: 8,
    outputItemKey: "industrialPress",
    outputQuantity: 1,
    inputs: [
      { itemKey: "powerUnit", quantity: 1 },
      { itemKey: "conveyorModule", quantity: 1 },
      { itemKey: "toolKit", quantity: 1 },
      { itemKey: "fasteners", quantity: 8 }
    ]
  },
  {
    key: "weaveSyntheticConduit",
    code: "WEAVE_SYNTHETIC_CONDUIT",
    name: "Weave Synthetic Conduit",
    durationTicks: 4,
    outputItemKey: "syntheticConduit",
    outputQuantity: 1,
    inputs: [
      { itemKey: "coal", quantity: 2 },
      { itemKey: "copperIngot", quantity: 1 }
    ]
  },
  {
    key: "assembleBiocellCanister",
    code: "ASSEMBLE_BIOCELL_CANISTER",
    name: "Assemble Biocell Canister",
    durationTicks: 5,
    outputItemKey: "biocellCanister",
    outputQuantity: 1,
    inputs: [
      { itemKey: "powerUnit", quantity: 1 },
      { itemKey: "coal", quantity: 1 },
      { itemKey: "copperIngot", quantity: 1 }
    ]
  },
  {
    key: "machineServoDrive",
    code: "MACHINE_SERVO_DRIVE",
    name: "Machine Servo Drive",
    durationTicks: 5,
    outputItemKey: "servoDrive",
    outputQuantity: 1,
    inputs: [
      { itemKey: "steelIngot", quantity: 2 },
      { itemKey: "fasteners", quantity: 2 },
      { itemKey: "machineParts", quantity: 1 }
    ]
  },
  {
    key: "machineOpticModule",
    code: "MACHINE_OPTIC_MODULE",
    name: "Machine Optic Module",
    durationTicks: 5,
    outputItemKey: "opticModule",
    outputQuantity: 1,
    inputs: [
      { itemKey: "copperIngot", quantity: 2 },
      { itemKey: "machineParts", quantity: 1 },
      { itemKey: "steelIngot", quantity: 1 }
    ]
  },
  {
    key: "assembleNeuralInterface",
    code: "ASSEMBLE_NEURAL_INTERFACE",
    name: "Assemble Neural Interface",
    durationTicks: 6,
    outputItemKey: "neuralInterface",
    outputQuantity: 1,
    inputs: [
      { itemKey: "opticModule", quantity: 1 },
      { itemKey: "biocellCanister", quantity: 1 },
      { itemKey: "machineParts", quantity: 1 }
    ]
  },
  {
    key: "assembleOcularImplant",
    code: "ASSEMBLE_OCULAR_IMPLANT",
    name: "Assemble Ocular Implant",
    durationTicks: 7,
    outputItemKey: "ocularImplant",
    outputQuantity: 1,
    inputs: [
      { itemKey: "opticModule", quantity: 2 },
      { itemKey: "neuralInterface", quantity: 1 },
      { itemKey: "syntheticConduit", quantity: 1 }
    ]
  },
  {
    key: "assembleCyberArmature",
    code: "ASSEMBLE_CYBER_ARMATURE",
    name: "Assemble Cyber Armature",
    durationTicks: 7,
    outputItemKey: "cyberArmature",
    outputQuantity: 1,
    inputs: [
      { itemKey: "servoDrive", quantity: 1 },
      { itemKey: "neuralInterface", quantity: 1 },
      { itemKey: "steelBeam", quantity: 1 },
      { itemKey: "fasteners", quantity: 3 }
    ]
  },
  {
    key: "integrateSpinalLink",
    code: "INTEGRATE_SPINAL_LINK",
    name: "Integrate Spinal Link",
    durationTicks: 7,
    outputItemKey: "spinalLink",
    outputQuantity: 1,
    inputs: [
      { itemKey: "syntheticConduit", quantity: 2 },
      { itemKey: "biocellCanister", quantity: 1 },
      { itemKey: "machineParts", quantity: 1 }
    ]
  },
  {
    key: "buildCyberneticSuite",
    code: "BUILD_CYBERNETIC_SUITE",
    name: "Build Cybernetic Suite",
    durationTicks: 9,
    outputItemKey: "cyberneticSuite",
    outputQuantity: 1,
    inputs: [
      { itemKey: "cyberArmature", quantity: 1 },
      { itemKey: "ocularImplant", quantity: 1 },
      { itemKey: "spinalLink", quantity: 1 },
      { itemKey: "toolKit", quantity: 1 },
      { itemKey: "powerUnit", quantity: 1 }
    ]
  }
];

const RESEARCH_DEFINITIONS: ResearchDefinition[] = [
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
    description: "Unlocks practical fabrication methods for wrench set production.",
    costCashCents: 55_000n,
    durationTicks: 3,
    unlockRecipeKeys: ["assembleTools"]
  },
  {
    key: "steelProcessing",
    code: "STEEL_PROCESSING",
    name: "Steel Processing",
    description: "Enables spring steel tempering and bolt kit assembly.",
    costCashCents: 85_000n,
    durationTicks: 4,
    unlockRecipeKeys: ["smeltSteel", "assembleFasteners"]
  },
  {
    key: "structuralFabrication",
    code: "STRUCTURAL_FABRICATION",
    name: "Structural Fabrication",
    description: "Allows rail segment machining for heavy structural workflows.",
    costCashCents: 120_000n,
    durationTicks: 5,
    unlockRecipeKeys: ["forgeSteelBeam"]
  },
  {
    key: "precisionManufacturing",
    code: "PRECISION_MANUFACTURING",
    name: "Precision Manufacturing",
    description: "Combines steel, copper, and tooling workflows into control boards.",
    costCashCents: 150_000n,
    durationTicks: 5,
    unlockRecipeKeys: ["machineParts"]
  },
  {
    key: "industrialLogistics",
    code: "INDUSTRIAL_LOGISTICS",
    name: "Industrial Logistics",
    description: "Unlocks scalable coordinated maintenance kit assembly methods.",
    costCashCents: 180_000n,
    durationTicks: 6,
    unlockRecipeKeys: ["assembleKits"]
  },
  {
    key: "powerSystems",
    code: "POWER_SYSTEMS",
    name: "Power Systems",
    description: "Introduces integrated electromechanical battery module design.",
    costCashCents: 220_000n,
    durationTicks: 6,
    unlockRecipeKeys: ["assemblePowerUnit", "weaveSyntheticConduit", "assembleBiocellCanister"]
  },
  {
    key: "automationLines",
    code: "AUTOMATION_LINES",
    name: "Automation Lines",
    description: "Adds modular roller assembly for repeatable factory throughput.",
    costCashCents: 260_000n,
    durationTicks: 7,
    unlockRecipeKeys: [
      "assembleConveyorModule",
      "machineServoDrive",
      "machineOpticModule",
      "integrateSpinalLink"
    ]
  },
  {
    key: "heavyIndustry",
    code: "HEAVY_INDUSTRY",
    name: "Heavy Industry",
    description: "Final-stage system integration for complete press chassis builds.",
    costCashCents: 320_000n,
    durationTicks: 8,
    unlockRecipeKeys: [
      "buildIndustrialPress",
      "assembleNeuralInterface",
      "assembleOcularImplant",
      "assembleCyberArmature",
      "buildCyberneticSuite"
    ]
  }
];

const RESEARCH_PREREQUISITES: Array<{
  nodeKey: string;
  prerequisiteKey: string;
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

const ICON_ITEM_DEFINITIONS: ItemDefinition[] = buildIconCatalogItems().map((item) => ({
  key: item.key,
  code: item.code,
  name: item.name,
  series: item.series,
  index: item.index,
  tier: item.tier,
  isFinalTier: item.isFinalTier,
  basePriceCents: item.basePriceCents
}));

function buildIconRecipeDefinitions(iconItems: ItemDefinition[]): RecipeDefinition[] {
  const bySeries = new Map<number, ItemDefinition[]>();
  for (const item of iconItems) {
    if (item.series === undefined) {
      continue;
    }
    const bucket = bySeries.get(item.series) ?? [];
    bucket.push(item);
    bySeries.set(item.series, bucket);
  }

  const recipes: RecipeDefinition[] = [];

  for (const seriesItems of bySeries.values()) {
    const ordered = [...seriesItems].sort((left, right) => (left.index ?? 0) - (right.index ?? 0));
    const tierSpan = Math.ceil(ordered.length / 4);

    for (let idx = 0; idx < ordered.length; idx += 1) {
      const item = ordered[idx];
      const tier = item.tier ?? 1;
      const previous = ordered[idx - 1];
      const tierAnchor = idx - tierSpan >= 0 ? ordered[idx - tierSpan] : undefined;
      const fallbackAnchor = tierAnchor ?? previous;

      const inputs: Array<{ itemKey: string; quantity: number }> = [];

      if (tier === 1) {
        inputs.push({ itemKey: "ironOre", quantity: 1 + ((item.index ?? 1) % 2) });
        inputs.push({
          itemKey: (item.index ?? 1) % 3 === 0 ? "copperOre" : "coal",
          quantity: 1
        });
      } else if (tier === 2 && previous) {
        inputs.push({ itemKey: previous.key, quantity: 1 });
        inputs.push({
          itemKey: (item.index ?? 1) % 2 === 0 ? "steelIngot" : "copperIngot",
          quantity: 1
        });
        inputs.push({ itemKey: "fasteners", quantity: 2 });
      } else if (tier === 3 && previous) {
        inputs.push({ itemKey: previous.key, quantity: 1 });
        inputs.push({ itemKey: (fallbackAnchor ?? previous).key, quantity: 1 });
        inputs.push({ itemKey: "machineParts", quantity: 1 });
      } else if (tier === 4 && previous) {
        inputs.push({ itemKey: previous.key, quantity: 1 });
        inputs.push({ itemKey: (fallbackAnchor ?? previous).key, quantity: 1 });
        inputs.push({ itemKey: "powerUnit", quantity: 1 });
        inputs.push({ itemKey: "syntheticConduit", quantity: 1 });
      }

      recipes.push({
        key: `fabricate_${item.key}`,
        code: `FABRICATE_${item.code}`,
        name: `Fabricate ${item.name}`,
        durationTicks: 2 + tier,
        outputItemKey: item.key,
        outputQuantity: tier === 1 ? 2 : 1,
        inputs
      });
    }
  }

  return recipes.sort((left, right) => left.code.localeCompare(right.code));
}

const ICON_RECIPE_DEFINITIONS = buildIconRecipeDefinitions(ICON_ITEM_DEFINITIONS);
const ITEM_DEFINITIONS: ItemDefinition[] = [...BASE_ITEM_DEFINITIONS, ...ICON_ITEM_DEFINITIONS];
const RECIPE_DEFINITIONS: RecipeDefinition[] = [...BASE_RECIPE_DEFINITIONS, ...ICON_RECIPE_DEFINITIONS];

const ICON_ITEM_BY_KEY = new Map(ICON_ITEM_DEFINITIONS.map((item) => [item.key, item] as const));
const ICON_TIER_ONE_ITEM_KEYS = ICON_ITEM_DEFINITIONS.filter((item) => item.tier === 1).map((item) => item.key);
const ICON_TIER_TWO_ITEM_KEYS = ICON_ITEM_DEFINITIONS.filter((item) => item.tier === 2).map((item) => item.key);
const ICON_FINAL_PRODUCT_KEYS = ICON_PACK_DEFINITIONS.map((pack) =>
  resolveIconItemKey(pack.series, pack.count)
);

function resolveIconPrice(itemKey: string): bigint {
  return ICON_ITEM_BY_KEY.get(itemKey)?.basePriceCents ?? 100n;
}

function isRecipeAutoUnlocked(recipeCode: string): boolean {
  return (
    recipeCode === "SMELT_IRON" ||
    recipeCode === "SMELT_COPPER" ||
    recipeCode.startsWith("FABRICATE_CP_")
  );
}

export async function seedWorld(
  prisma: PrismaClient,
  options: SeedWorldOptions = {}
): Promise<SeedWorldResult> {
  if (options.reset) {
    await resetSimulationData(prisma);
  }

  const itemsByKey: Record<string, { id: string; code: string; name: string }> = {};
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
      cashCents: 2_500_000n,
      reservedCashCents: 0n
    }
  });

  const botSmelter = await prisma.company.create({
    data: {
      code: "BOT_SMELTER",
      name: "Northwind Smelting",
      isPlayer: false,
      regionId: coreRegion.id,
      cashCents: 2_500_000n,
      reservedCashCents: 0n
    }
  });

  const botTrader = await prisma.company.create({
    data: {
      code: "BOT_TRADER",
      name: "Summit Trading",
      isPlayer: false,
      regionId: coreRegion.id,
      cashCents: 2_500_000n,
      reservedCashCents: 0n
    }
  });

  const inventoryRows: Array<{
    companyId: string;
    itemKey: string;
    quantity: number;
    reservedQuantity?: number;
  }> = [
    { companyId: playerCompany.id, itemKey: "ironOre", quantity: 240 },
    { companyId: playerCompany.id, itemKey: "coal", quantity: 140 },
    { companyId: playerCompany.id, itemKey: "copperOre", quantity: 180 },
    { companyId: playerCompany.id, itemKey: "ironIngot", quantity: 12 },
    { companyId: playerCompany.id, itemKey: "copperIngot", quantity: 6 },

    { companyId: botMiner.id, itemKey: "ironOre", quantity: 700 },
    { companyId: botMiner.id, itemKey: "coal", quantity: 650 },
    { companyId: botMiner.id, itemKey: "copperOre", quantity: 520 },

    { companyId: botSmelter.id, itemKey: "ironIngot", quantity: 320 },
    { companyId: botSmelter.id, itemKey: "copperIngot", quantity: 220 },
    { companyId: botSmelter.id, itemKey: "steelIngot", quantity: 180 },
    { companyId: botSmelter.id, itemKey: "fasteners", quantity: 300 },
    { companyId: botSmelter.id, itemKey: "steelBeam", quantity: 70 },
    { companyId: botSmelter.id, itemKey: "syntheticConduit", quantity: 190 },
    { companyId: botSmelter.id, itemKey: "biocellCanister", quantity: 120 },
    { companyId: botSmelter.id, itemKey: "servoDrive", quantity: 90 },
    { companyId: botSmelter.id, itemKey: "opticModule", quantity: 80 },

    { companyId: botTrader.id, itemKey: "handTools", quantity: 140 },
    { companyId: botTrader.id, itemKey: "machineParts", quantity: 70 },
    { companyId: botTrader.id, itemKey: "toolKit", quantity: 36 },
    { companyId: botTrader.id, itemKey: "powerUnit", quantity: 16 },
    { companyId: botTrader.id, itemKey: "conveyorModule", quantity: 10 },
    { companyId: botTrader.id, itemKey: "industrialPress", quantity: 2 },
    { companyId: botTrader.id, itemKey: "neuralInterface", quantity: 45 },
    { companyId: botTrader.id, itemKey: "ocularImplant", quantity: 24 },
    { companyId: botTrader.id, itemKey: "cyberArmature", quantity: 18 },
    { companyId: botTrader.id, itemKey: "spinalLink", quantity: 22 },
    { companyId: botTrader.id, itemKey: "cyberneticSuite", quantity: 3 }
  ];

  for (const itemKey of ICON_TIER_ONE_ITEM_KEYS) {
    inventoryRows.push({
      companyId: botSmelter.id,
      itemKey,
      quantity: 80
    });
  }

  for (const itemKey of ICON_TIER_TWO_ITEM_KEYS) {
    inventoryRows.push({
      companyId: botTrader.id,
      itemKey,
      quantity: 20
    });
  }

  for (const itemKey of ICON_FINAL_PRODUCT_KEYS) {
    inventoryRows.push({
      companyId: botTrader.id,
      itemKey,
      quantity: 3
    });
  }

  await prisma.inventory.createMany({
    data: inventoryRows.map((row) => ({
      companyId: row.companyId,
      itemId: itemsByKey[row.itemKey].id,
      regionId: coreRegion.id,
      quantity: row.quantity,
      reservedQuantity: row.reservedQuantity ?? 0
    }))
  });

  const recipesByKey: Record<string, { id: string; code: string }> = {};
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
  const allRecipes = Object.values(recipesByKey);

  for (const company of companies) {
    await prisma.companyRecipe.createMany({
      data: allRecipes.map((recipe) => ({
        companyId: company.id,
        recipeId: recipe.id,
        isUnlocked: isRecipeAutoUnlocked(recipe.code)
      }))
    });
  }

  const researchNodesByKey: Record<string, { id: string; code: string }> = {};
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
    itemKey: string;
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
      companyId: botSmelter.id,
      itemKey: "syntheticConduit",
      side: OrderSide.SELL,
      quantity: 110,
      unitPriceCents: 520n
    },
    {
      companyId: botSmelter.id,
      itemKey: "biocellCanister",
      side: OrderSide.SELL,
      quantity: 80,
      unitPriceCents: 780n
    },
    {
      companyId: botSmelter.id,
      itemKey: "servoDrive",
      side: OrderSide.SELL,
      quantity: 44,
      unitPriceCents: 1_450n
    },
    {
      companyId: botSmelter.id,
      itemKey: "opticModule",
      side: OrderSide.SELL,
      quantity: 40,
      unitPriceCents: 1_820n
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
      itemKey: "neuralInterface",
      side: OrderSide.SELL,
      quantity: 24,
      unitPriceCents: 3_600n
    },
    {
      companyId: botTrader.id,
      itemKey: "ocularImplant",
      side: OrderSide.SELL,
      quantity: 12,
      unitPriceCents: 8_200n
    },
    {
      companyId: botTrader.id,
      itemKey: "cyberArmature",
      side: OrderSide.SELL,
      quantity: 10,
      unitPriceCents: 9_400n
    },
    {
      companyId: botTrader.id,
      itemKey: "spinalLink",
      side: OrderSide.SELL,
      quantity: 12,
      unitPriceCents: 7_600n
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
    },
    {
      companyId: botTrader.id,
      itemKey: "cyberneticSuite",
      side: OrderSide.BUY,
      quantity: 3,
      unitPriceCents: 24_000n
    }
  ];

  for (const itemKey of ICON_TIER_ONE_ITEM_KEYS) {
    marketSeedOrders.push({
      companyId: botSmelter.id,
      itemKey,
      side: OrderSide.SELL,
      quantity: 35,
      unitPriceCents: resolveIconPrice(itemKey)
    });
  }

  for (const itemKey of ICON_TIER_TWO_ITEM_KEYS) {
    marketSeedOrders.push({
      companyId: botTrader.id,
      itemKey,
      side: OrderSide.SELL,
      quantity: 12,
      unitPriceCents: resolveIconPrice(itemKey)
    });
  }

  for (const itemKey of ICON_FINAL_PRODUCT_KEYS) {
    const basePrice = resolveIconPrice(itemKey);
    marketSeedOrders.push({
      companyId: botTrader.id,
      itemKey,
      side: OrderSide.BUY,
      quantity: 3,
      unitPriceCents: (basePrice * 95n) / 100n
    });
  }

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

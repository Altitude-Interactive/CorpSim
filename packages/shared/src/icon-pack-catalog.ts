export interface IconPackDefinition {
  series: number;
  count: number;
  codePrefix: string;
  namePrefix: string;
  basePriceCents: number;
}

export interface IconCatalogItemDefinition {
  key: string;
  code: string;
  iconFileName: string;
  name: string;
  series: number;
  index: number;
  tier: number;
  isFinalTier: boolean;
  basePriceCents: bigint;
}

interface IconNameLexicon {
  adjectives: readonly string[];
  nouns: readonly string[];
}

export const ICON_PACK_DEFINITIONS: ReadonlyArray<IconPackDefinition> = [
  { series: 1, count: 40, codePrefix: "CP_BALLISTIC_PAYLOAD", namePrefix: "Ballistic Payload", basePriceCents: 950 },
  { series: 2, count: 40, codePrefix: "CP_MEDICAL_COMPOUND", namePrefix: "Medical Compound", basePriceCents: 700 },
  { series: 3, count: 40, codePrefix: "CP_STREET_MEAL", namePrefix: "Street Meal", basePriceCents: 420 },
  { series: 4, count: 40, codePrefix: "CP_UTILITY_GADGET", namePrefix: "Utility Gadget", basePriceCents: 1_400 },
  { series: 5, count: 40, codePrefix: "CP_SNACK_CARTRIDGE", namePrefix: "Snack Cartridge", basePriceCents: 380 },
  { series: 6, count: 40, codePrefix: "CP_RESOURCE_CANISTER", namePrefix: "Resource Canister", basePriceCents: 520 },
  { series: 8, count: 40, codePrefix: "CP_POCKET_DEVICE", namePrefix: "Pocket Device", basePriceCents: 860 },
  { series: 9, count: 40, codePrefix: "CP_NEURAL_IMPLANT", namePrefix: "Neural Implant", basePriceCents: 2_600 },
  { series: 10, count: 40, codePrefix: "CP_PROTECTIVE_SUIT", namePrefix: "Protective Suit", basePriceCents: 1_800 },
  { series: 11, count: 40, codePrefix: "CP_GENOME_ASSET", namePrefix: "Genome Asset", basePriceCents: 2_300 },
  { series: 12, count: 40, codePrefix: "CP_DRONE_MODULE", namePrefix: "Drone Module", basePriceCents: 2_100 },
  { series: 13, count: 40, codePrefix: "CP_MACHINE_COMPONENT", namePrefix: "Machine Component", basePriceCents: 1_300 },
  { series: 14, count: 40, codePrefix: "CP_RESOURCE_BLOCK", namePrefix: "Resource Block", basePriceCents: 560 },
  { series: 15, count: 40, codePrefix: "CP_FIREARM_ASSEMBLY", namePrefix: "Firearm Assembly", basePriceCents: 2_200 },
  { series: 17, count: 40, codePrefix: "CP_CYBER_GARMENT", namePrefix: "Cyber Garment", basePriceCents: 780 },
  { series: 18, count: 40, codePrefix: "CP_FIELD_TOOL", namePrefix: "Field Tool", basePriceCents: 900 },
  { series: 19, count: 40, codePrefix: "CP_AUGMENT_JEWELRY", namePrefix: "Augment Jewelry", basePriceCents: 1_650 },
  { series: 20, count: 40, codePrefix: "CP_HOUSEHOLD_UTILITY", namePrefix: "Household Utility", basePriceCents: 640 },
  { series: 21, count: 40, codePrefix: "CP_NUTRIENT_MEAL", namePrefix: "Nutrient Meal", basePriceCents: 500 },
  { series: 22, count: 20, codePrefix: "CP_ARTIFACT_RELIC", namePrefix: "Artifact Relic", basePriceCents: 2_100 },
  { series: 23, count: 40, codePrefix: "CP_FASHION_GARMENT", namePrefix: "Fashion Garment", basePriceCents: 820 },
  { series: 29, count: 40, codePrefix: "CP_WEAPON_PLATFORM", namePrefix: "Weapon Platform", basePriceCents: 2_050 },
  { series: 30, count: 40, codePrefix: "CP_STREET_APPAREL", namePrefix: "Street Apparel", basePriceCents: 760 },
  { series: 31, count: 40, codePrefix: "CP_MINING_PAYLOAD", namePrefix: "Mining Payload", basePriceCents: 980 },
  { series: 32, count: 40, codePrefix: "CP_IMPLANT_CHASSIS", namePrefix: "Implant Chassis", basePriceCents: 2_450 },
  { series: 33, count: 20, codePrefix: "CP_ARTIFACT_CORE", namePrefix: "Artifact Core", basePriceCents: 2_300 },
  { series: 34, count: 40, codePrefix: "CP_BIO_VEGETATION", namePrefix: "Bio Vegetation", basePriceCents: 470 },
  { series: 35, count: 40, codePrefix: "CP_AGRI_PRODUCE", namePrefix: "Agri Produce", basePriceCents: 450 },
  { series: 37, count: 40, codePrefix: "CP_LUXURY_JEWEL", namePrefix: "Luxury Jewel", basePriceCents: 1_750 },
  { series: 38, count: 40, codePrefix: "CP_URBAN_CLOTHING", namePrefix: "Urban Clothing", basePriceCents: 790 }
] as const;

const PACK_BY_SERIES = new Map<number, IconPackDefinition>(
  ICON_PACK_DEFINITIONS.map((definition) => [definition.series, definition] as const)
);
const PACK_BY_CODE_PREFIX = new Map<string, IconPackDefinition>(
  ICON_PACK_DEFINITIONS.map((definition) => [definition.codePrefix, definition] as const)
);

const ICON_NAME_LEXICON_BY_SERIES = new Map<number, IconNameLexicon>([
  [
    1,
    {
      adjectives: ["Armor-Piercing", "High-Impact", "Tracer", "Hollow-Point", "Tungsten", "Incendiary", "Shock", "Dense"],
      nouns: ["Round", "Slug", "Shell", "Canister", "Magazine", "Warhead", "Dart", "Charge"]
    }
  ],
  [
    2,
    {
      adjectives: ["Sterile", "Rapid", "Stabilizing", "Regen", "Neuro", "Cardio", "Immune", "Trauma"],
      nouns: ["Serum", "Medgel", "Injector", "Patch", "Ampoule", "Stim", "Nanodose", "Antidote"]
    }
  ],
  [
    3,
    {
      adjectives: ["Grilled", "Spiced", "Smoked", "Crispy", "Braised", "Savory", "Tangy", "Herbed"],
      nouns: ["Wrap", "Skewer", "Bun", "Noodle Cup", "Rice Bowl", "Stew", "Taco", "Sandwich"]
    }
  ],
  [
    4,
    {
      adjectives: ["Compact", "Foldable", "Tactical", "Rugged", "Portable", "Precision", "Auto", "Adaptive"],
      nouns: ["Multitool", "Scanner", "Driver", "Torch", "Beacon", "Grappler", "Welder", "Analyzer"]
    }
  ],
  [
    5,
    {
      adjectives: ["Salted", "Sweet", "Spicy", "Savory", "Roasted", "Smoked", "Honeyed", "Crunchy"],
      nouns: ["Bites", "Cluster", "Wafer", "Bar", "Cracker", "Stick", "Ration", "Nugget"]
    }
  ],
  [
    6,
    {
      adjectives: ["Refined", "Pressurized", "Dense", "Stable", "Reactive", "Filtered", "Cryo", "Catalyzed"],
      nouns: ["Canister", "Cell", "Capsule", "Reservoir", "Phial", "Tank", "Vial", "Cylinder"]
    }
  ],
  [
    8,
    {
      adjectives: ["Pocket", "Mini", "Secure", "Signal", "Pulse", "Smart", "Encrypted", "Urban"],
      nouns: ["Console", "Pad", "Link", "Beacon", "Tracker", "Transceiver", "Projector", "Reader"]
    }
  ],
  [
    9,
    {
      adjectives: ["Synaptic", "Ocular", "Auditory", "Motor", "Reflex", "Memory", "Cortical", "Tactile"],
      nouns: ["Implant", "Node", "Coil", "Bridge", "Array", "Interface", "Lattice", "Socket"]
    }
  ],
  [
    10,
    {
      adjectives: ["Reinforced", "Insulated", "Hazmat", "Shockproof", "Combat", "Stealth", "Thermal", "Weathered"],
      nouns: ["Suit", "Vest", "Mask", "Gloves", "Boots", "Cloak", "Helmet", "Harness"]
    }
  ],
  [
    11,
    {
      adjectives: ["Engineered", "Edited", "Adaptive", "Resilient", "Hybrid", "Pristine", "Recombinant", "Cultured"],
      nouns: ["Genome", "Sample", "Sequence", "Culture", "Splice", "Template", "Matrix", "Archive"]
    }
  ],
  [
    12,
    {
      adjectives: ["Recon", "Survey", "Guard", "Repair", "Courier", "Scout", "Response", "Utility"],
      nouns: ["Drone", "Rotor", "Frame", "Core", "Module", "Pod", "Unit", "Rig"]
    }
  ],
  [
    13,
    {
      adjectives: ["Machined", "Forged", "Cast", "CNC", "Tempered", "Precision", "Balanced", "Industrial"],
      nouns: ["Bracket", "Actuator", "Bearing", "Coupler", "Gearbox", "Joint", "Spindle", "Assembly"]
    }
  ],
  [
    14,
    {
      adjectives: ["Raw", "Processed", "Compressed", "Polished", "Alloyed", "Sintered", "Purified", "Milled"],
      nouns: ["Ingot", "Brick", "Plate", "Billet", "Slab", "Prism", "Core", "Block"]
    }
  ],
  [
    15,
    {
      adjectives: ["Compact", "Suppressed", "Longshot", "Burst", "Heavy", "Precision", "Tactical", "Modular"],
      nouns: ["Rifle", "Carbine", "Pistol", "SMG", "Shotgun", "Launcher", "Chassis", "Receiver"]
    }
  ],
  [
    17,
    {
      adjectives: ["Urban", "Reinforced", "Neon", "Reactive", "Adaptive", "Thermal", "Stealth", "Patterned"],
      nouns: ["Jacket", "Coat", "Hoodie", "Pants", "Vest", "Poncho", "Suit", "Shell"]
    }
  ],
  [
    18,
    {
      adjectives: ["Maintenance", "Field", "Precision", "Heavy", "Portable", "Emergency", "Workshop", "Repair"],
      nouns: ["Wrench", "Driver", "Cutter", "Spanner", "Clamp", "Crimper", "Prybar", "Toolkit"]
    }
  ],
  [
    19,
    {
      adjectives: ["Chromed", "Neon", "Etched", "Augmented", "Luminous", "Reactive", "Polished", "Forged"],
      nouns: ["Ring", "Pendant", "Bracelet", "Brooch", "Charm", "Band", "Earring", "Amulet"]
    }
  ],
  [
    20,
    {
      adjectives: ["Smart", "Compact", "Efficient", "Modular", "Auto", "Programmable", "Portable", "Household"],
      nouns: ["Kettle", "Vacuum", "Cooker", "Cleaner", "Filter", "Lamp", "Purifier", "Charger"]
    }
  ],
  [
    21,
    {
      adjectives: ["Protein", "Fiber", "Balanced", "Fortified", "Hearty", "Lean", "Savory", "Fresh"],
      nouns: ["Meal", "Bowl", "Tray", "Pack", "Ration", "Stew", "Plate", "Portion"]
    }
  ],
  [
    22,
    {
      adjectives: ["Ancient", "Forgotten", "Runed", "Primal", "Arcane", "Mythic", "Echoing", "Lost"],
      nouns: ["Relic", "Totem", "Idol", "Tablet", "Sigil", "Shard", "Effigy", "Artifact"]
    }
  ],
  [
    23,
    {
      adjectives: ["Tailored", "Patterned", "Minimal", "Retro", "Street", "Bold", "Layered", "Designer"],
      nouns: ["Shirt", "Top", "Skirt", "Dress", "Jacket", "Pants", "Blazer", "Outfit"]
    }
  ],
  [
    29,
    {
      adjectives: ["Siege", "Tactical", "Heavy", "Modular", "Precision", "Rail", "Pulse", "Assault"],
      nouns: ["Platform", "Turret", "Chassis", "Battery", "Mount", "Launcher", "Array", "Frame"]
    }
  ],
  [
    30,
    {
      adjectives: ["Street", "Casual", "Layered", "Urban", "Sport", "Techwear", "Relaxed", "Classic"],
      nouns: ["Hoodie", "Jacket", "Pants", "Cap", "Sneakers", "Shirt", "Vest", "Set"]
    }
  ],
  [
    31,
    {
      adjectives: ["Deep-Core", "Prospector", "Heavy", "Reinforced", "Auto", "Hydraulic", "Rockbreaker", "Industrial"],
      nouns: ["Drill", "Charge", "Rig", "Extractor", "Bit", "Harvester", "Payload", "Borehead"]
    }
  ],
  [
    32,
    {
      adjectives: ["Servo", "Neural", "Bio", "Reflex", "Stability", "Titan", "Phantom", "Synapse"],
      nouns: ["Chassis", "Frame", "Socket", "Housing", "Core", "Cradle", "Assembly", "Backbone"]
    }
  ],
  [
    33,
    {
      adjectives: ["Ancient", "Luminous", "Runed", "Prismatic", "Harmonic", "Celestial", "Quantum", "Eternal"],
      nouns: ["Core", "Nexus", "Heart", "Seed", "Matrix", "Kernel", "Catalyst", "Anchor"]
    }
  ],
  [
    34,
    {
      adjectives: ["Bioluminescent", "Spined", "Rooted", "Blooming", "Spiral", "Velvet", "Verdant", "Mossy"],
      nouns: ["Fern", "Vine", "Moss", "Pod", "Bloom", "Spore", "Sprout", "Frond"]
    }
  ],
  [
    37,
    {
      adjectives: ["Royal", "Imperial", "Radiant", "Gilded", "Prismatic", "Regal", "Brilliant", "Ornate"],
      nouns: ["Gem", "Necklace", "Ring", "Crown", "Bracelet", "Pendant", "Brooch", "Tiara"]
    }
  ],
  [
    38,
    {
      adjectives: ["Metro", "Slim", "Tailored", "Lightweight", "Classic", "Contoured", "Modern", "Refined"],
      nouns: ["Blazer", "Coat", "Trousers", "Shirt", "Dress", "Jacket", "Uniform", "Outfit"]
    }
  ]
]);

const ICON_NAME_OVERRIDES_BY_SERIES = new Map<number, readonly string[]>([
  [
    35,
    [
      "Potato",
      "Tomato",
      "Carrot",
      "Onion",
      "Cabbage",
      "Lettuce",
      "Spinach",
      "Broccoli",
      "Cauliflower",
      "Cucumber",
      "Eggplant",
      "Bell Pepper",
      "Chili Pepper",
      "Pumpkin",
      "Zucchini",
      "Corn",
      "Peas",
      "Green Beans",
      "Beetroot",
      "Radish",
      "Turnip",
      "Sweet Potato",
      "Yam",
      "Garlic",
      "Ginger",
      "Mushroom",
      "Celery",
      "Leek",
      "Kale",
      "Bok Choy",
      "Avocado",
      "Okra",
      "Artichoke",
      "Asparagus",
      "Brussels Sprouts",
      "Parsnip",
      "Shallot",
      "Scallion",
      "Fennel",
      "Chard"
    ]
  ]
]);

const FALLBACK_NAME_WORDS = [
  "Alpha",
  "Bravo",
  "Charlie",
  "Delta",
  "Echo",
  "Foxtrot",
  "Gamma",
  "Helix",
  "Ion",
  "Jade",
  "Kilo",
  "Lambda",
  "Metro",
  "Nova",
  "Onyx",
  "Pulse",
  "Quartz",
  "Rogue",
  "Sigma",
  "Titan"
] as const;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function resolveIconItemName(pack: IconPackDefinition, index: number): string {
  const namesOverride = ICON_NAME_OVERRIDES_BY_SERIES.get(pack.series);
  const overrideName = namesOverride?.[index - 1];
  if (overrideName) {
    return overrideName;
  }

  const lexicon = ICON_NAME_LEXICON_BY_SERIES.get(pack.series);
  if (lexicon && lexicon.adjectives.length > 0 && lexicon.nouns.length > 0) {
    const adjective = lexicon.adjectives[(index - 1) % lexicon.adjectives.length];
    const noun = lexicon.nouns[Math.floor((index - 1) / lexicon.adjectives.length) % lexicon.nouns.length];
    return `${adjective} ${noun}`;
  }

  return `${pack.namePrefix} ${FALLBACK_NAME_WORDS[(index - 1) % FALLBACK_NAME_WORDS.length]}`;
}

export function resolveIconItemCode(series: number, index: number): string {
  const pack = PACK_BY_SERIES.get(series);
  if (!pack) {
    return `CP_SERIES_${pad2(series)}_${pad2(index)}`;
  }

  return `${pack.codePrefix}_${pad2(index)}`;
}

export function resolveIconItemKey(series: number, index: number): string {
  return `icon_${pad2(series)}_${pad2(index)}`;
}

export function parseIconItemCode(code: string): { series: number; index: number } | null {
  const match = /^([A-Z0-9_]+)_(\d{2})$/.exec(code);
  if (!match) {
    return null;
  }

  const codePrefix = match[1];
  const pack = PACK_BY_CODE_PREFIX.get(codePrefix);
  if (!pack) {
    return null;
  }

  const index = Number.parseInt(match[2], 10);
  if (!Number.isFinite(index)) {
    return null;
  }

  return { series: pack.series, index };
}

function resolveTier(index: number, count: number): number {
  const tierSize = Math.ceil(count / 4);
  const tier = Math.floor((index - 1) / tierSize) + 1;
  return Math.min(4, Math.max(1, tier));
}

function resolvePriceForPackIndex(pack: IconPackDefinition, index: number): bigint {
  const tier = resolveTier(index, pack.count);
  const tierMarkup = Math.round(pack.basePriceCents * 0.55 * (tier - 1));
  const variantMarkup = index * 7;
  return BigInt(pack.basePriceCents + tierMarkup + variantMarkup);
}

export function resolveIconItemFallbackPriceCents(code: string): bigint | undefined {
  const parsed = parseIconItemCode(code);
  if (!parsed) {
    return undefined;
  }

  const pack = PACK_BY_SERIES.get(parsed.series);
  if (!pack) {
    return undefined;
  }
  if (parsed.index < 1 || parsed.index > pack.count) {
    return undefined;
  }

  return resolvePriceForPackIndex(pack, parsed.index);
}

export function resolveIconItemAssetFileName(series: number, index: number): string {
  return `icon_${pad2(series)}_${pad2(index)}.png`;
}

export function resolveIconItemAssetSrcByCode(code: string): string | undefined {
  const parsed = parseIconItemCode(code);
  if (!parsed) {
    return undefined;
  }

  const pack = PACK_BY_SERIES.get(parsed.series);
  if (!pack) {
    return undefined;
  }
  if (parsed.index < 1 || parsed.index > pack.count) {
    return undefined;
  }

  return `/assets/items/${resolveIconItemAssetFileName(parsed.series, parsed.index)}`;
}

function buildIconCatalogItemsInternal(): IconCatalogItemDefinition[] {
  const rows: IconCatalogItemDefinition[] = [];

  for (const pack of ICON_PACK_DEFINITIONS) {
    for (let index = 1; index <= pack.count; index += 1) {
      const tier = resolveTier(index, pack.count);
      rows.push({
        key: resolveIconItemKey(pack.series, index),
        code: resolveIconItemCode(pack.series, index),
        iconFileName: resolveIconItemAssetFileName(pack.series, index),
        name: resolveIconItemName(pack, index),
        series: pack.series,
        index,
        tier,
        isFinalTier: tier === 4,
        basePriceCents: resolvePriceForPackIndex(pack, index)
      });
    }
  }

  return rows;
}

const ICON_CATALOG_ITEMS = buildIconCatalogItemsInternal();
const ICON_CATALOG_ITEM_BY_CODE = new Map<string, IconCatalogItemDefinition>(
  ICON_CATALOG_ITEMS.map((item) => [item.code, item] as const)
);

export function buildIconCatalogItems(): IconCatalogItemDefinition[] {
  return ICON_CATALOG_ITEMS.map((item) => ({ ...item }));
}

export function getIconCatalogItemByCode(code: string): IconCatalogItemDefinition | undefined {
  return ICON_CATALOG_ITEM_BY_CODE.get(code);
}

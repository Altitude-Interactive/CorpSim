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

function pad2(value: number): string {
  return String(value).padStart(2, "0");
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
        name: `${pack.namePrefix} ${pad2(index)}`,
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

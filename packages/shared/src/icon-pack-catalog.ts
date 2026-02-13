export interface IconPackDefinition {
  series: number;
  count: number;
  namePrefix: string;
  basePriceCents: number;
}

export interface IconCatalogItemDefinition {
  key: string;
  code: string;
  name: string;
  series: number;
  index: number;
  tier: number;
  isFinalTier: boolean;
  basePriceCents: bigint;
}

export const ICON_PACK_DEFINITIONS: ReadonlyArray<IconPackDefinition> = [
  { series: 1, count: 40, namePrefix: "Ballistic Payload", basePriceCents: 950 },
  { series: 2, count: 40, namePrefix: "Medical Compound", basePriceCents: 700 },
  { series: 3, count: 40, namePrefix: "Street Meal", basePriceCents: 420 },
  { series: 4, count: 40, namePrefix: "Utility Gadget", basePriceCents: 1_400 },
  { series: 5, count: 40, namePrefix: "Snack Cartridge", basePriceCents: 380 },
  { series: 6, count: 40, namePrefix: "Resource Canister", basePriceCents: 520 },
  { series: 8, count: 40, namePrefix: "Pocket Device", basePriceCents: 860 },
  { series: 9, count: 40, namePrefix: "Neural Implant", basePriceCents: 2_600 },
  { series: 10, count: 40, namePrefix: "Protective Suit", basePriceCents: 1_800 },
  { series: 11, count: 40, namePrefix: "Genome Asset", basePriceCents: 2_300 },
  { series: 12, count: 40, namePrefix: "Drone Module", basePriceCents: 2_100 },
  { series: 13, count: 40, namePrefix: "Machine Component", basePriceCents: 1_300 },
  { series: 14, count: 40, namePrefix: "Resource Block", basePriceCents: 560 },
  { series: 15, count: 40, namePrefix: "Firearm Assembly", basePriceCents: 2_200 },
  { series: 17, count: 40, namePrefix: "Cyber Garment", basePriceCents: 780 },
  { series: 18, count: 40, namePrefix: "Field Tool", basePriceCents: 900 },
  { series: 19, count: 40, namePrefix: "Augment Jewelry", basePriceCents: 1_650 },
  { series: 20, count: 40, namePrefix: "Household Utility", basePriceCents: 640 },
  { series: 21, count: 40, namePrefix: "Nutrient Meal", basePriceCents: 500 },
  { series: 22, count: 20, namePrefix: "Artifact Relic", basePriceCents: 2_100 },
  { series: 23, count: 40, namePrefix: "Fashion Garment", basePriceCents: 820 },
  { series: 29, count: 40, namePrefix: "Weapon Platform", basePriceCents: 2_050 },
  { series: 30, count: 40, namePrefix: "Street Apparel", basePriceCents: 760 },
  { series: 31, count: 40, namePrefix: "Mining Payload", basePriceCents: 980 },
  { series: 32, count: 40, namePrefix: "Implant Chassis", basePriceCents: 2_450 },
  { series: 33, count: 20, namePrefix: "Artifact Core", basePriceCents: 2_300 },
  { series: 34, count: 40, namePrefix: "Bio Vegetation", basePriceCents: 470 },
  { series: 35, count: 40, namePrefix: "Agri Produce", basePriceCents: 450 },
  { series: 37, count: 40, namePrefix: "Luxury Jewel", basePriceCents: 1_750 },
  { series: 38, count: 40, namePrefix: "Urban Clothing", basePriceCents: 790 }
] as const;

const PACK_BY_SERIES = new Map<number, IconPackDefinition>(
  ICON_PACK_DEFINITIONS.map((definition) => [definition.series, definition] as const)
);

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function resolveIconItemCode(series: number, index: number): string {
  return `ICON_${pad2(series)}_${pad2(index)}`;
}

export function resolveIconItemKey(series: number, index: number): string {
  return `icon_${pad2(series)}_${pad2(index)}`;
}

export function parseIconItemCode(code: string): { series: number; index: number } | null {
  const match = /^ICON_(\d{2})_(\d{2})$/.exec(code);
  if (!match) {
    return null;
  }

  const series = Number.parseInt(match[1], 10);
  const index = Number.parseInt(match[2], 10);
  if (!Number.isFinite(series) || !Number.isFinite(index)) {
    return null;
  }

  return { series, index };
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

export function buildIconCatalogItems(): IconCatalogItemDefinition[] {
  const rows: IconCatalogItemDefinition[] = [];

  for (const pack of ICON_PACK_DEFINITIONS) {
    for (let index = 1; index <= pack.count; index += 1) {
      const tier = resolveTier(index, pack.count);
      rows.push({
        key: resolveIconItemKey(pack.series, index),
        code: resolveIconItemCode(pack.series, index),
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

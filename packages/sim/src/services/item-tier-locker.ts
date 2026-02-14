import {
  CompanySpecialization,
  getIconCatalogItemByCode,
  isItemCodeLockedBySpecialization,
  normalizeCompanySpecialization
} from "@corpsim/shared";

const MIN_ICON_TIER = 1;
const MAX_ICON_TIER = 4;

const ICON_TIER_UNLOCK_MILESTONES: ReadonlyArray<{
  researchCode: string;
  tier: number;
}> = [
  { researchCode: "POWER_SYSTEMS", tier: 2 },
  { researchCode: "AUTOMATION_LINES", tier: 3 },
  { researchCode: "HEAVY_INDUSTRY", tier: 4 }
];

export interface RecipeForItemTierLock {
  outputItem: { code: string };
  inputs: Array<{ item: { code: string } }>;
}

export interface RecipeForItemSpecializationLock {
  outputItem: { code: string };
}

function clampIconTier(tier: number): number {
  if (!Number.isInteger(tier)) {
    return MIN_ICON_TIER;
  }

  return Math.min(MAX_ICON_TIER, Math.max(MIN_ICON_TIER, tier));
}

export function resolvePlayerUnlockedIconTierFromResearchCodes(
  completedResearchCodes: Iterable<string>
): number {
  const completed = new Set<string>(completedResearchCodes);
  let unlockedTier = MIN_ICON_TIER;

  for (const milestone of ICON_TIER_UNLOCK_MILESTONES) {
    if (completed.has(milestone.researchCode)) {
      unlockedTier = Math.max(unlockedTier, milestone.tier);
    }
  }

  return clampIconTier(unlockedTier);
}

export function isItemCodeLockedByIconTier(itemCode: string, unlockedIconTier: number): boolean {
  const iconItem = getIconCatalogItemByCode(itemCode);
  if (!iconItem) {
    return false;
  }

  return iconItem.tier > clampIconTier(unlockedIconTier);
}

export function isRecipeLockedByIconTier(
  recipe: RecipeForItemTierLock,
  unlockedIconTier: number
): boolean {
  if (isItemCodeLockedByIconTier(recipe.outputItem.code, unlockedIconTier)) {
    return true;
  }

  for (const input of recipe.inputs) {
    if (isItemCodeLockedByIconTier(input.item.code, unlockedIconTier)) {
      return true;
    }
  }

  return false;
}

export function isRecipeLockedBySpecialization(
  recipe: RecipeForItemSpecializationLock,
  specialization: CompanySpecialization
): boolean {
  return isItemCodeLockedBySpecialization(
    recipe.outputItem.code,
    normalizeCompanySpecialization(specialization)
  );
}

/**
 * Item Tier Locker - Research-Based Access Control
 *
 * @module item-tier-locker
 *
 * ## Purpose
 * Implements tier-based access control for items and recipes based on player research
 * milestones. Enforces progression gates so players must research technologies before
 * accessing higher-tier content.
 *
 * ## Icon Tier System
 * Items categorized into 4 tiers:
 * - **Tier 1**: Basic items (always available)
 * - **Tier 2**: Unlocked by POWER_SYSTEMS research
 * - **Tier 3**: Unlocked by AUTOMATION_LINES research
 * - **Tier 4**: Unlocked by HEAVY_INDUSTRY research
 *
 * ## Key Operations
 * - **resolvePlayerUnlockedIconTierFromResearchCodes**: Determines highest unlocked tier
 *   from completed research codes
 * - **isItemCodeLockedByIconTier**: Checks if item is locked for player
 * - **isRecipeLockedByIconTier**: Checks if recipe is locked for player
 * - **isRecipeLockedBySpecialization**: Checks if recipe requires specific company specialization
 *
 * ## Validation Flow
 * 1. Query player's completed research codes
 * 2. Resolve highest unlocked tier (1-4)
 * 3. Check item/recipe tier requirement
 * 4. Also check specialization constraints
 * 5. Return locked status
 *
 * ## Integration Points
 * Used by:
 * - Production service (validate recipe access before job creation)
 * - Market orders (validate item access before order placement)
 * - Shipments (validate item access before shipment creation)
 * - Read models (filter available items/recipes for players)
 *
 * ## NPC Companies
 * NPC companies are not subject to tier locks (they can access all tiers).
 * Locks only apply to player-owned companies.
 *
 * ## Determinism
 * Tier unlocking is deterministic based on research codes.
 * Same research progress → same tier access.
 */
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

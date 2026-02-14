import { parseIconItemCode } from "./icon-pack-catalog";

export const COMPANY_SPECIALIZATION_CODES = [
  "UNASSIGNED",
  "INDUSTRIAL",
  "BIOTECH",
  "CONSUMER",
  "DEFENSE"
] as const;

export type CompanySpecialization = (typeof COMPANY_SPECIALIZATION_CODES)[number];

export const ITEM_CATEGORY_CODES = [
  "FOUNDATIONAL",
  "INDUSTRIAL_GOODS",
  "BIOTECH_SYSTEMS",
  "CONSUMER_GOODS",
  "DEFENSE_SYSTEMS"
] as const;

export type ItemCategory = (typeof ITEM_CATEGORY_CODES)[number];

export interface ItemCategoryDefinition {
  code: ItemCategory;
  label: string;
  description: string;
}

export interface CompanySpecializationDefinition {
  code: CompanySpecialization;
  label: string;
  description: string;
  unlockedCategories: readonly ItemCategory[];
  sampleItemCodes: readonly string[];
}

const ITEM_CATEGORY_DEFINITIONS: ReadonlyArray<ItemCategoryDefinition> = [
  {
    code: "FOUNDATIONAL",
    label: "Foundational Materials",
    description: "Core supplies every company can use."
  },
  {
    code: "INDUSTRIAL_GOODS",
    label: "Industrial Goods",
    description: "Heavy components and factory equipment."
  },
  {
    code: "BIOTECH_SYSTEMS",
    label: "Biotech Systems",
    description: "Advanced implants and biotech assemblies."
  },
  {
    code: "CONSUMER_GOODS",
    label: "Consumer Goods",
    description: "Everyday products for households and retail."
  },
  {
    code: "DEFENSE_SYSTEMS",
    label: "Defense Systems",
    description: "Military and security-focused products."
  }
];

const COMPANY_SPECIALIZATION_DEFINITIONS: ReadonlyArray<CompanySpecializationDefinition> = [
  {
    code: "UNASSIGNED",
    label: "No Focus",
    description: "No specialty selected yet. You can only handle foundational materials.",
    unlockedCategories: ["FOUNDATIONAL"],
    sampleItemCodes: ["IRON_ORE", "COAL", "COPPER_ORE", "IRON_INGOT"]
  },
  {
    code: "INDUSTRIAL",
    label: "Industrial Manufacturing",
    description: "Focus on factory hardware, mechanical parts, and production equipment.",
    unlockedCategories: ["FOUNDATIONAL", "INDUSTRIAL_GOODS"],
    sampleItemCodes: ["STEEL_INGOT", "MACHINE_PARTS", "POWER_UNIT", "CONVEYOR_MODULE"]
  },
  {
    code: "BIOTECH",
    label: "Biotech and Implants",
    description: "Focus on biotech modules, neural components, and cybernetic products.",
    unlockedCategories: ["FOUNDATIONAL", "BIOTECH_SYSTEMS"],
    sampleItemCodes: ["BIOCELL_CANISTER", "NEURAL_INTERFACE", "OCULAR_IMPLANT", "CYBER_ARMATURE"]
  },
  {
    code: "CONSUMER",
    label: "Consumer Products",
    description: "Focus on food, apparel, and everyday household products.",
    unlockedCategories: ["FOUNDATIONAL", "CONSUMER_GOODS"],
    sampleItemCodes: ["CP_STREET_MEAL_01", "CP_FASHION_GARMENT_01", "CP_HOUSEHOLD_UTILITY_01"]
  },
  {
    code: "DEFENSE",
    label: "Defense and Security",
    description: "Focus on weapon systems, tactical gear, and security payloads.",
    unlockedCategories: ["FOUNDATIONAL", "DEFENSE_SYSTEMS"],
    sampleItemCodes: ["CP_BALLISTIC_PAYLOAD_01", "CP_FIREARM_ASSEMBLY_01", "CP_WEAPON_PLATFORM_01"]
  }
];

const ITEM_CATEGORY_BY_CODE = new Map<string, ItemCategory>([
  ["IRON_ORE", "FOUNDATIONAL"],
  ["COAL", "FOUNDATIONAL"],
  ["COPPER_ORE", "FOUNDATIONAL"],
  ["IRON_INGOT", "FOUNDATIONAL"],
  ["COPPER_INGOT", "FOUNDATIONAL"],
  ["HAND_TOOLS", "FOUNDATIONAL"],
  ["STEEL_INGOT", "INDUSTRIAL_GOODS"],
  ["STEEL_BEAM", "INDUSTRIAL_GOODS"],
  ["FASTENERS", "INDUSTRIAL_GOODS"],
  ["MACHINE_PARTS", "INDUSTRIAL_GOODS"],
  ["TOOL_KIT", "INDUSTRIAL_GOODS"],
  ["POWER_UNIT", "INDUSTRIAL_GOODS"],
  ["CONVEYOR_MODULE", "INDUSTRIAL_GOODS"],
  ["INDUSTRIAL_PRESS", "INDUSTRIAL_GOODS"],
  ["SYNTHETIC_CONDUIT", "BIOTECH_SYSTEMS"],
  ["BIOCELL_CANISTER", "BIOTECH_SYSTEMS"],
  ["SERVO_DRIVE", "BIOTECH_SYSTEMS"],
  ["OPTIC_MODULE", "BIOTECH_SYSTEMS"],
  ["NEURAL_INTERFACE", "BIOTECH_SYSTEMS"],
  ["OCULAR_IMPLANT", "BIOTECH_SYSTEMS"],
  ["CYBER_ARMATURE", "BIOTECH_SYSTEMS"],
  ["SPINAL_LINK", "BIOTECH_SYSTEMS"],
  ["CYBERNETIC_SUITE", "BIOTECH_SYSTEMS"]
]);

const ICON_SERIES_CATEGORY = new Map<number, ItemCategory>([
  [1, "DEFENSE_SYSTEMS"],
  [2, "BIOTECH_SYSTEMS"],
  [3, "CONSUMER_GOODS"],
  [4, "INDUSTRIAL_GOODS"],
  [5, "CONSUMER_GOODS"],
  [6, "INDUSTRIAL_GOODS"],
  [8, "INDUSTRIAL_GOODS"],
  [9, "BIOTECH_SYSTEMS"],
  [10, "DEFENSE_SYSTEMS"],
  [11, "BIOTECH_SYSTEMS"],
  [12, "INDUSTRIAL_GOODS"],
  [13, "INDUSTRIAL_GOODS"],
  [14, "INDUSTRIAL_GOODS"],
  [15, "DEFENSE_SYSTEMS"],
  [17, "CONSUMER_GOODS"],
  [18, "INDUSTRIAL_GOODS"],
  [19, "CONSUMER_GOODS"],
  [20, "CONSUMER_GOODS"],
  [21, "CONSUMER_GOODS"],
  [22, "DEFENSE_SYSTEMS"],
  [23, "CONSUMER_GOODS"],
  [29, "DEFENSE_SYSTEMS"],
  [30, "CONSUMER_GOODS"],
  [31, "INDUSTRIAL_GOODS"],
  [32, "BIOTECH_SYSTEMS"],
  [33, "BIOTECH_SYSTEMS"],
  [34, "CONSUMER_GOODS"],
  [35, "CONSUMER_GOODS"],
  [37, "CONSUMER_GOODS"],
  [38, "CONSUMER_GOODS"]
]);

const COMPANY_SPECIALIZATION_BY_CODE = new Map<CompanySpecialization, CompanySpecializationDefinition>(
  COMPANY_SPECIALIZATION_DEFINITIONS.map((entry) => [entry.code, entry] as const)
);

const ITEM_CATEGORY_BY_ID = new Map<ItemCategory, ItemCategoryDefinition>(
  ITEM_CATEGORY_DEFINITIONS.map((entry) => [entry.code, entry] as const)
);

export function normalizeCompanySpecialization(
  value: string | null | undefined
): CompanySpecialization {
  if (!value) {
    return "UNASSIGNED";
  }
  return COMPANY_SPECIALIZATION_BY_CODE.has(value as CompanySpecialization)
    ? (value as CompanySpecialization)
    : "UNASSIGNED";
}

export function listCompanySpecializationDefinitions(): CompanySpecializationDefinition[] {
  return COMPANY_SPECIALIZATION_DEFINITIONS.map((entry) => ({
    ...entry,
    unlockedCategories: [...entry.unlockedCategories],
    sampleItemCodes: [...entry.sampleItemCodes]
  }));
}

export function getCompanySpecializationDefinition(
  code: CompanySpecialization
): CompanySpecializationDefinition {
  return COMPANY_SPECIALIZATION_BY_CODE.get(code) ?? COMPANY_SPECIALIZATION_DEFINITIONS[0];
}

export function listItemCategoryDefinitions(): ItemCategoryDefinition[] {
  return ITEM_CATEGORY_DEFINITIONS.map((entry) => ({ ...entry }));
}

export function getItemCategoryDefinition(code: ItemCategory): ItemCategoryDefinition {
  return ITEM_CATEGORY_BY_ID.get(code) ?? ITEM_CATEGORY_DEFINITIONS[0];
}

export function resolveItemCategoryByCode(itemCode: string): ItemCategory | null {
  const staticCategory = ITEM_CATEGORY_BY_CODE.get(itemCode);
  if (staticCategory) {
    return staticCategory;
  }

  const parsedIcon = parseIconItemCode(itemCode);
  if (!parsedIcon) {
    return null;
  }

  return ICON_SERIES_CATEGORY.get(parsedIcon.series) ?? null;
}

export function isItemCategoryUnlockedForSpecialization(
  category: ItemCategory,
  specialization: CompanySpecialization
): boolean {
  if (category === "FOUNDATIONAL") {
    return true;
  }

  const specializationDefinition = getCompanySpecializationDefinition(
    normalizeCompanySpecialization(specialization)
  );
  return specializationDefinition.unlockedCategories.includes(category);
}

export function isItemCodeLockedBySpecialization(
  itemCode: string,
  specialization: CompanySpecialization
): boolean {
  const category = resolveItemCategoryByCode(itemCode);
  if (!category) {
    return false;
  }

  return !isItemCategoryUnlockedForSpecialization(
    category,
    normalizeCompanySpecialization(specialization)
  );
}

export const UNKNOWN_ITEM_ICON_SRC = "/assets/items/unknown.png";

const ITEM_ICON_BY_CODE: Record<string, string> = {
  IRON_ORE: "/assets/items/iron_ore.png",
  COAL: "/assets/items/coal.png",
  COPPER_ORE: "/assets/items/copper_ore.png",
  IRON_INGOT: "/assets/items/iron_ingot.png",
  COPPER_INGOT: "/assets/items/copper_ingot.png",
  HAND_TOOLS: "/assets/items/hand_tools.png",
  STEEL_INGOT: "/assets/items/steel_ingot.png",
  STEEL_BEAM: "/assets/items/steel_beam.png",
  FASTENERS: "/assets/items/fasteners.png",
  MACHINE_PARTS: "/assets/items/machine_parts.png",
  TOOL_KIT: "/assets/items/tool_kit.png",
  POWER_UNIT: "/assets/items/power_unit.png",
  CONVEYOR_MODULE: "/assets/items/conveyor_module.png",
  INDUSTRIAL_PRESS: "/assets/items/industrial_press.png"
};

export function getItemIconSrc(itemCode: string | null | undefined): string {
  if (!itemCode) {
    return UNKNOWN_ITEM_ICON_SRC;
  }

  return ITEM_ICON_BY_CODE[itemCode] ?? UNKNOWN_ITEM_ICON_SRC;
}

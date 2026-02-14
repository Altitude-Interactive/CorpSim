import { resolveIconItemAssetSrcByCode } from "@corpsim/shared";

export const UNKNOWN_ITEM_ICON_SRC = "/assets/items/unknown.png";

export type ItemIconResolutionStatus = "mapped" | "generated" | "unknown";

export interface ItemIconResolution {
  src: string;
  status: ItemIconResolutionStatus;
}

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
  INDUSTRIAL_PRESS: "/assets/items/industrial_press.png",
  SYNTHETIC_CONDUIT: "/assets/items/synthetic_conduit.png",
  BIOCELL_CANISTER: "/assets/items/biocell_canister.png",
  SERVO_DRIVE: "/assets/items/servo_drive.png",
  OPTIC_MODULE: "/assets/items/optic_module.png",
  NEURAL_INTERFACE: "/assets/items/neural_interface.png",
  OCULAR_IMPLANT: "/assets/items/ocular_implant.png",
  CYBER_ARMATURE: "/assets/items/cyber_armature.png",
  SPINAL_LINK: "/assets/items/spinal_link.png",
  CYBERNETIC_SUITE: "/assets/items/cybernetic_suite.png"
};

export function resolveItemIcon(itemCode: string | null | undefined): ItemIconResolution {
  if (!itemCode) {
    return { src: UNKNOWN_ITEM_ICON_SRC, status: "unknown" };
  }

  if (ITEM_ICON_BY_CODE[itemCode]) {
    return { src: ITEM_ICON_BY_CODE[itemCode], status: "mapped" };
  }

  const generatedIconSrc = resolveIconItemAssetSrcByCode(itemCode);
  if (generatedIconSrc) {
    return { src: generatedIconSrc, status: "generated" };
  }

  return { src: UNKNOWN_ITEM_ICON_SRC, status: "unknown" };
}

export function getItemIconSrc(itemCode: string | null | undefined): string {
  return resolveItemIcon(itemCode).src;
}

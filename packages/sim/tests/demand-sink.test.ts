import { describe, expect, it } from "vitest";
import {
  DEFAULT_DEMAND_SINK_CONFIG,
  resolveDemandQuantityForCompanyItem,
  resolveDemandSinkConfig
} from "../src/services/demand-sink";

describe("demand sink", () => {
  it("normalizes item code overrides and preserves deterministic defaults", () => {
    const config = resolveDemandSinkConfig({
      itemCodes: ["TOOL_KIT", "HAND_TOOLS", "TOOL_KIT", "  MACHINE_PARTS  "],
      baseQuantityPerCompany: 2,
      variabilityQuantity: 3
    });

    expect(config).toEqual({
      enabled: true,
      itemCodes: ["HAND_TOOLS", "MACHINE_PARTS", "TOOL_KIT"],
      baseQuantityPerCompany: 2,
      variabilityQuantity: 3
    });
  });

  it("returns deterministic quantities for the same company, item, and tick", () => {
    const config = resolveDemandSinkConfig({
      enabled: true,
      itemCodes: ["HAND_TOOLS"],
      baseQuantityPerCompany: 1,
      variabilityQuantity: 4
    });

    const first = resolveDemandQuantityForCompanyItem("BOT_TRADER", "HAND_TOOLS", 25, config);
    const second = resolveDemandQuantityForCompanyItem("BOT_TRADER", "HAND_TOOLS", 25, config);

    expect(first).toBe(second);
    expect(first).toBeGreaterThanOrEqual(config.baseQuantityPerCompany);
    expect(first).toBeLessThanOrEqual(
      config.baseQuantityPerCompany + config.variabilityQuantity
    );
  });

  it("throws when configured with negative quantities", () => {
    expect(() =>
      resolveDemandSinkConfig({
        baseQuantityPerCompany: -1
      })
    ).toThrow("baseQuantityPerCompany must be a non-negative integer");

    expect(() =>
      resolveDemandSinkConfig({
        variabilityQuantity: -1
      })
    ).toThrow("variabilityQuantity must be a non-negative integer");
  });

  it("supports a zero-variability fixed demand profile", () => {
    const fixed = resolveDemandSinkConfig({
      ...DEFAULT_DEMAND_SINK_CONFIG,
      baseQuantityPerCompany: 7,
      variabilityQuantity: 0
    });

    expect(resolveDemandQuantityForCompanyItem("BOT_A", "TOOL_KIT", 1, fixed)).toBe(7);
    expect(resolveDemandQuantityForCompanyItem("BOT_A", "TOOL_KIT", 999, fixed)).toBe(7);
  });
});

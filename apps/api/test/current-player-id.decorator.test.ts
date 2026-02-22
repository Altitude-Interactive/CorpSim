import { describe, expect, it } from "vitest";
import { canAdminAccessPlayerGameplayEndpoint } from "../src/common/decorators/current-player-id.decorator";

describe("canAdminAccessPlayerGameplayEndpoint", () => {
  it("allows admin GET requests to developer catalog read endpoints", () => {
    expect(canAdminAccessPlayerGameplayEndpoint({ method: "GET", url: "/v1/companies" })).toBe(true);
    expect(canAdminAccessPlayerGameplayEndpoint({ method: "GET", url: "/v1/items" })).toBe(true);
    expect(canAdminAccessPlayerGameplayEndpoint({ method: "GET", url: "/v1/production/recipes" })).toBe(
      true
    );
    expect(
      canAdminAccessPlayerGameplayEndpoint({
        method: "GET",
        url: "/v1/research?companyId=company_seed"
      })
    ).toBe(true);
  });

  it("denies admin access for non-allowlisted paths", () => {
    expect(
      canAdminAccessPlayerGameplayEndpoint({
        method: "GET",
        url: "/v1/market/orders"
      })
    ).toBe(false);
  });

  it("denies admin access for write methods even on allowlisted paths", () => {
    expect(
      canAdminAccessPlayerGameplayEndpoint({
        method: "POST",
        url: "/v1/production/recipes"
      })
    ).toBe(false);
  });
});

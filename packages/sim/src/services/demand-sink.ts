import { Prisma } from "@prisma/client";
import { DomainInvariantError } from "../domain/errors";

export interface DemandSinkConfig {
  enabled: boolean;
  itemCodes: string[];
  baseQuantityPerCompany: number;
  variabilityQuantity: number;
}

export interface DemandSinkTickResult {
  consumedTotal: number;
  consumedByItemCode: Record<string, number>;
}

const DEFAULT_ITEM_CODES = [
  "HAND_TOOLS",
  "MACHINE_PARTS",
  "TOOL_KIT",
  "POWER_UNIT",
  "CONVEYOR_MODULE",
  "INDUSTRIAL_PRESS"
];

export const DEFAULT_DEMAND_SINK_CONFIG: DemandSinkConfig = {
  enabled: true,
  itemCodes: DEFAULT_ITEM_CODES,
  baseQuantityPerCompany: 1,
  variabilityQuantity: 2
};

function normalizeItemCodes(itemCodes: string[]): string[] {
  const normalized = itemCodes.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
  return [...new Set(normalized)].sort((left, right) => left.localeCompare(right));
}

function validateConfig(config: DemandSinkConfig): void {
  if (!Number.isInteger(config.baseQuantityPerCompany) || config.baseQuantityPerCompany < 0) {
    throw new DomainInvariantError("baseQuantityPerCompany must be a non-negative integer");
  }
  if (!Number.isInteger(config.variabilityQuantity) || config.variabilityQuantity < 0) {
    throw new DomainInvariantError("variabilityQuantity must be a non-negative integer");
  }
}

function stableHash(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function resolveDemandSinkConfig(overrides: Partial<DemandSinkConfig> = {}): DemandSinkConfig {
  const itemCodes = normalizeItemCodes(overrides.itemCodes ?? DEFAULT_DEMAND_SINK_CONFIG.itemCodes);
  const resolved: DemandSinkConfig = {
    enabled: overrides.enabled ?? DEFAULT_DEMAND_SINK_CONFIG.enabled,
    itemCodes,
    baseQuantityPerCompany:
      overrides.baseQuantityPerCompany ?? DEFAULT_DEMAND_SINK_CONFIG.baseQuantityPerCompany,
    variabilityQuantity:
      overrides.variabilityQuantity ?? DEFAULT_DEMAND_SINK_CONFIG.variabilityQuantity
  };
  validateConfig(resolved);
  return resolved;
}

export function resolveDemandQuantityForCompanyItem(
  companyCode: string,
  itemCode: string,
  tick: number,
  config: DemandSinkConfig
): number {
  if (!Number.isInteger(tick) || tick < 0) {
    throw new DomainInvariantError("tick must be a non-negative integer");
  }

  const base = config.baseQuantityPerCompany;
  const variability = config.variabilityQuantity;
  if (variability === 0) {
    return base;
  }

  const seed = stableHash(`${companyCode}:${itemCode}`);
  const offset = (tick + seed) % (variability + 1);
  return base + offset;
}

interface InventoryRow {
  companyId: string;
  itemId: string;
  regionId: string;
  quantity: number;
  reservedQuantity: number;
}

export async function runDemandSinkForTick(
  tx: Prisma.TransactionClient,
  tick: number,
  overrides: Partial<DemandSinkConfig> = {}
): Promise<DemandSinkTickResult> {
  if (!Number.isInteger(tick) || tick < 0) {
    throw new DomainInvariantError("tick must be a non-negative integer");
  }

  const config = resolveDemandSinkConfig(overrides);
  if (!config.enabled || config.itemCodes.length === 0) {
    return { consumedTotal: 0, consumedByItemCode: {} };
  }

  const [items, companies] = await Promise.all([
    tx.item.findMany({
      where: { code: { in: config.itemCodes } },
      orderBy: { code: "asc" },
      select: { id: true, code: true }
    }),
    tx.company.findMany({
      where: {
        isPlayer: false,
        ownerPlayerId: null
      },
      orderBy: { code: "asc" },
      select: { id: true, code: true }
    })
  ]);

  if (items.length === 0 || companies.length === 0) {
    return { consumedTotal: 0, consumedByItemCode: {} };
  }

  const companyIds = companies.map((entry) => entry.id);
  const itemIds = items.map((entry) => entry.id);
  const inventories = await tx.inventory.findMany({
    where: {
      companyId: { in: companyIds },
      itemId: { in: itemIds },
      quantity: { gt: 0 }
    },
    select: {
      companyId: true,
      itemId: true,
      regionId: true,
      quantity: true,
      reservedQuantity: true
    }
  });

  const inventoriesByCompanyItem = new Map<string, InventoryRow[]>();
  for (const row of inventories) {
    const key = `${row.companyId}:${row.itemId}`;
    const bucket = inventoriesByCompanyItem.get(key) ?? [];
    bucket.push({
      companyId: row.companyId,
      itemId: row.itemId,
      regionId: row.regionId,
      quantity: row.quantity,
      reservedQuantity: row.reservedQuantity
    });
    inventoriesByCompanyItem.set(key, bucket);
  }

  const consumedByItemCode = new Map<string, number>();
  let consumedTotal = 0;

  for (const company of companies) {
    for (const item of items) {
      let remainingDemand = resolveDemandQuantityForCompanyItem(company.code, item.code, tick, config);
      if (remainingDemand <= 0) {
        continue;
      }

      const key = `${company.id}:${item.id}`;
      const rows = [...(inventoriesByCompanyItem.get(key) ?? [])].sort((left, right) =>
        left.regionId.localeCompare(right.regionId)
      );

      for (const row of rows) {
        if (remainingDemand <= 0) {
          break;
        }

        const available = row.quantity - row.reservedQuantity;
        if (available <= 0) {
          continue;
        }

        const consumed = Math.min(available, remainingDemand);
        if (consumed <= 0) {
          continue;
        }

        await tx.inventory.update({
          where: {
            companyId_itemId_regionId: {
              companyId: row.companyId,
              itemId: row.itemId,
              regionId: row.regionId
            }
          },
          data: {
            quantity: {
              decrement: consumed
            }
          }
        });

        row.quantity -= consumed;
        remainingDemand -= consumed;
        consumedTotal += consumed;
        consumedByItemCode.set(item.code, (consumedByItemCode.get(item.code) ?? 0) + consumed);
      }
    }
  }

  const consumedByItemCodeRecord = Object.fromEntries(
    [...consumedByItemCode.entries()].sort(([left], [right]) => left.localeCompare(right))
  );
  return {
    consumedTotal,
    consumedByItemCode: consumedByItemCodeRecord
  };
}

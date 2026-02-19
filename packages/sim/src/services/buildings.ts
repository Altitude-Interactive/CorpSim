/**
 * Building Infrastructure Service
 *
 * @module buildings
 *
 * ## Purpose
 * Manages the lifecycle of buildings in the infrastructure-based production system.
 * Buildings provide production capacity, storage, and corporate capabilities with
 * mandatory operating costs. This enforces capital investment requirements and
 * introduces fixed-cost financial risk.
 *
 * ## Building Lifecycle
 * 1. **Acquisition**: Company purchases building, pays acquisition cost, building created in ACTIVE state
 * 2. **Operation**: Weekly operating costs deducted from company cash during tick processing
 * 3. **Deactivation**: If operating costs cannot be paid, building becomes INACTIVE, production paused
 * 4. **Reactivation**: When cash is available, building can be manually or automatically reactivated
 *
 * ## Building Types and Categories
 * - **PRODUCTION**: WORKSHOP, MINE, FARM, FACTORY, MEGA_FACTORY
 *   - Provide production job capacity
 *   - Required for production jobs
 *   - Have capacity slots limiting concurrent jobs
 * - **STORAGE**: WAREHOUSE
 *   - Increase regional storage capacity
 *   - Prevent infinite stock scaling
 *   - Have weekly operating costs
 * - **CORPORATE**: HEADQUARTERS, RND_CENTER
 *   - Unlock corporate-level capabilities
 *   - May provide strategic bonuses (future)
 *   - Required for advanced automation (future)
 *
 * ## Invariants Enforced
 * - **No Negative Cash**: Operating costs cannot create negative balance
 * - **Mandatory Ledger Entries**: All financial mutations write ledger entries
 * - **Reserved Cash Respect**: Operating costs check available cash (after reservations)
 * - **Regional Association**: Buildings tied to specific region
 * - **Operating Cost Tracking**: lastOperatingCostTick prevents duplicate charges
 *
 * ## Invariants Planned (Not Yet Enforced)
 * - **Capacity Limits**: Production jobs cannot exceed building capacity (Phase 2)
 * - **Active Building Requirement**: Production requires ACTIVE building (Phase 2)
 * - **Storage Limits**: Warehouse capacity limits inventory (Phase 3)
 *
 * ## Financial Rules
 * - Acquisition cost paid upfront (immediate ledger entry)
 * - Operating costs charged weekly (7 ticks)
 * - If cash insufficient:
 *   - Building status set to INACTIVE
 *   - Production paused (no new jobs, existing jobs continue)
 *   - No silent balance mutation allowed
 *
 * ## Side Effects
 * All operations are transactional:
 * - Building creation: Deducts acquisition cost, creates building record, creates ledger entry
 * - Operating cost application: Deducts cost OR deactivates building, creates ledger entry
 * - Building reactivation: Updates status to ACTIVE (no cost)
 *
 * ## Transaction Boundaries
 * - Each operation (acquire, deactivate, reactivate) is atomic
 * - Operating costs applied in batch during tick processing
 * - Rollback on any validation failure or constraint violation
 *
 * ## Determinism
 * - Operating costs apply every 7 ticks deterministically
 * - Processing order: by building ID (lexicographic)
 * - Deactivation deterministic based on cash availability
 *
 * ## Error Handling
 * - NotFoundError: Building or company doesn't exist
 * - InsufficientFundsError: Cannot afford acquisition cost
 * - DomainInvariantError: Validation failures (negative costs, invalid type)
 * - All state changes are transactional; failures leave no partial state
 */

import {
  BuildingStatus,
  BuildingType,
  LedgerEntryType,
  Prisma,
  PrismaClient
} from "@prisma/client";
import {
  DomainInvariantError,
  InsufficientFundsError,
  NotFoundError
} from "../domain/errors";
import { availableCash } from "../domain/reservations";

/**
 * Input for acquiring a new building
 */
export interface AcquireBuildingInput {
  companyId: string;
  regionId: string;
  buildingType: BuildingType;
  acquisitionCostCents: bigint;
  weeklyOperatingCostCents: bigint;
  capacitySlots?: number;
  tick: number;
  name?: string;
}

/**
 * Input for applying operating costs to all active buildings
 */
export interface ApplyBuildingOperatingCostsInput {
  tick: number;
}

/**
 * Result of applying operating costs
 */
export interface ApplyBuildingOperatingCostsResult {
  processedCount: number;
  deactivatedCount: number;
  totalCostCents: bigint;
}

/**
 * Input for reactivating an inactive building
 */
export interface ReactivateBuildingInput {
  buildingId: string;
  tick: number;
}

/**
 * ## Building Staffing (Future Enhancement)
 *
 * When employee assignment is implemented:
 * - Buildings will have minEmployees, maxEmployees, employeesAssigned fields
 * - Effective capacity = baseCapacity * (employeesAssigned - minEmployees) / (maxEmployees - minEmployees)
 * - Buildings with employeesAssigned < minEmployees automatically set to INACTIVE status
 * - Staffing changes do not affect running production jobs, only new jobs
 *
 * Current implementation:
 * - All buildings use full capacity when ACTIVE
 * - Staffing mechanics deferred to future phase
 */

/**
 * Constants
 */
export const BUILDING_OPERATING_COST_INTERVAL_TICKS = 7; // Weekly
export const BASE_STORAGE_CAPACITY_PER_REGION = 1000;
export const WAREHOUSE_CAPACITY_PER_SLOT = 500;

/**
 * Validates building acquisition input
 */
function validateAcquireBuildingInput(input: AcquireBuildingInput): void {
  if (!input.companyId) {
    throw new DomainInvariantError("companyId is required");
  }

  if (!input.regionId) {
    throw new DomainInvariantError("regionId is required");
  }

  if (!input.buildingType) {
    throw new DomainInvariantError("buildingType is required");
  }

  if (input.acquisitionCostCents < 0n) {
    throw new DomainInvariantError("acquisitionCostCents cannot be negative");
  }

  if (input.weeklyOperatingCostCents < 0n) {
    throw new DomainInvariantError("weeklyOperatingCostCents cannot be negative");
  }

  if (input.capacitySlots !== undefined && input.capacitySlots < 1) {
    throw new DomainInvariantError("capacitySlots must be at least 1");
  }

  if (input.tick < 0) {
    throw new DomainInvariantError("tick must be non-negative");
  }
}

/**
 * Acquires a new building for a company
 *
 * @param tx - Prisma transaction client
 * @param input - Building acquisition parameters
 * @returns Created building
 *
 * @throws {NotFoundError} If company or region doesn't exist
 * @throws {InsufficientFundsError} If company cannot afford acquisition cost
 * @throws {DomainInvariantError} If validation fails
 */
export async function acquireBuildingWithTx(
  tx: Prisma.TransactionClient,
  input: AcquireBuildingInput
) {
  validateAcquireBuildingInput(input);

  const company = await tx.company.findUnique({
    where: { id: input.companyId },
    select: {
      id: true,
      cashCents: true,
      reservedCashCents: true
    }
  });

  if (!company) {
    throw new NotFoundError(`company ${input.companyId} not found`);
  }

  const region = await tx.region.findUnique({
    where: { id: input.regionId },
    select: { id: true }
  });

  if (!region) {
    throw new NotFoundError(`region ${input.regionId} not found`);
  }

  const available = availableCash({
    cashCents: company.cashCents,
    reservedCashCents: company.reservedCashCents
  });

  if (available < input.acquisitionCostCents) {
    throw new InsufficientFundsError(
      `insufficient cash to acquire building: need ${input.acquisitionCostCents}, have ${available}`
    );
  }

  const newCashCents = company.cashCents - input.acquisitionCostCents;

  await tx.company.update({
    where: { id: input.companyId },
    data: {
      cashCents: newCashCents
    }
  });

  const building = await tx.building.create({
    data: {
      companyId: input.companyId,
      regionId: input.regionId,
      buildingType: input.buildingType,
      status: BuildingStatus.ACTIVE,
      name: input.name ?? null,
      acquisitionCostCents: input.acquisitionCostCents,
      weeklyOperatingCostCents: input.weeklyOperatingCostCents,
      capacitySlots: input.capacitySlots ?? 1,
      tickAcquired: input.tick,
      lastOperatingCostTick: input.tick
    }
  });

  await tx.ledgerEntry.create({
    data: {
      companyId: input.companyId,
      tick: input.tick,
      entryType: LedgerEntryType.BUILDING_ACQUISITION,
      deltaCashCents: -input.acquisitionCostCents,
      deltaReservedCashCents: 0n,
      balanceAfterCents: newCashCents,
      referenceType: "BUILDING",
      referenceId: building.id
    }
  });

  return building;
}

/**
 * Applies operating costs to all active buildings for the current tick
 *
 * @param tx - Prisma transaction client
 * @param input - Tick information
 * @returns Result summary
 *
 * @remarks
 * - Operating costs charged every BUILDING_OPERATING_COST_INTERVAL_TICKS (weekly)
 * - Buildings with insufficient available cash (after reservations) are deactivated
 * - Ledger entries created for each cost application
 * - Processing order is deterministic (by building ID)
 * - Fresh company data fetched for each building to avoid stale cash values
 */
export async function applyBuildingOperatingCostsWithTx(
  tx: Prisma.TransactionClient,
  input: ApplyBuildingOperatingCostsInput
): Promise<ApplyBuildingOperatingCostsResult> {
  const { tick } = input;

  if (tick < 0) {
    throw new DomainInvariantError("tick must be non-negative");
  }

  // Find buildings due for operating cost (without company data to avoid stale values)
  const dueBuildings = await tx.building.findMany({
    where: {
      status: BuildingStatus.ACTIVE,
      OR: [
        {
          lastOperatingCostTick: null
        },
        {
          lastOperatingCostTick: {
            lte: tick - BUILDING_OPERATING_COST_INTERVAL_TICKS
          }
        }
      ]
    },
    orderBy: {
      id: "asc" // Deterministic processing order
    },
    select: {
      id: true,
      companyId: true,
      weeklyOperatingCostCents: true
    }
  });

  let processedCount = 0;
  let deactivatedCount = 0;
  let totalCostCents = 0n;

  for (const building of dueBuildings) {
    const operatingCost = building.weeklyOperatingCostCents;

    // Fetch fresh company data to avoid stale cash values when processing multiple buildings
    const company = await tx.company.findUniqueOrThrow({
      where: { id: building.companyId },
      select: {
        id: true,
        cashCents: true,
        reservedCashCents: true
      }
    });

    // Check if company has sufficient available cash (respecting reservations)
    const available = availableCash({
      cashCents: company.cashCents,
      reservedCashCents: company.reservedCashCents
    });

    if (available >= operatingCost) {
      // Company can afford operating cost
      const newCashCents = company.cashCents - operatingCost;

      await tx.company.update({
        where: { id: building.companyId },
        data: {
          cashCents: newCashCents
        }
      });

      await tx.building.update({
        where: { id: building.id },
        data: {
          lastOperatingCostTick: tick
        }
      });

      await tx.ledgerEntry.create({
        data: {
          companyId: building.companyId,
          tick,
          entryType: LedgerEntryType.BUILDING_OPERATING_COST,
          deltaCashCents: -operatingCost,
          deltaReservedCashCents: 0n,
          balanceAfterCents: newCashCents,
          referenceType: "BUILDING",
          referenceId: building.id
        }
      });

      totalCostCents += operatingCost;
      processedCount++;
    } else {
      // Company cannot afford operating cost - deactivate building
      await tx.building.update({
        where: { id: building.id },
        data: {
          status: BuildingStatus.INACTIVE,
          lastOperatingCostTick: tick
        }
      });

      deactivatedCount++;
    }
  }

  return {
    processedCount,
    deactivatedCount,
    totalCostCents
  };
}

/**
 * Reactivates an inactive building
 *
 * @param tx - Prisma transaction client
 * @param input - Building and tick information
 * @returns Updated building
 *
 * @throws {NotFoundError} If building doesn't exist
 * @throws {DomainInvariantError} If building is not inactive
 *
 * @remarks
 * - No cost to reactivate
 * - Building must be in INACTIVE status
 * - Does not charge backdated operating costs
 */
export async function reactivateBuildingWithTx(
  tx: Prisma.TransactionClient,
  input: ReactivateBuildingInput
) {
  if (!input.buildingId) {
    throw new DomainInvariantError("buildingId is required");
  }

  if (input.tick < 0) {
    throw new DomainInvariantError("tick must be non-negative");
  }

  const building = await tx.building.findUnique({
    where: { id: input.buildingId }
  });

  if (!building) {
    throw new NotFoundError(`building ${input.buildingId} not found`);
  }

  if (building.status !== BuildingStatus.INACTIVE) {
    throw new DomainInvariantError(
      `building ${input.buildingId} is not inactive (current status: ${building.status})`
    );
  }

  return tx.building.update({
    where: { id: input.buildingId },
    data: {
      status: BuildingStatus.ACTIVE,
      lastOperatingCostTick: input.tick
    }
  });
}

/**
 * Gets buildings for a company
 *
 * @param tx - Prisma transaction client or client
 * @param companyId - Company ID
 * @returns Array of buildings
 */
export async function getBuildingsForCompany(
  tx: Prisma.TransactionClient | PrismaClient,
  companyId: string
) {
  return tx.building.findMany({
    where: { companyId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }]
  });
}

/**
 * Checks if a company has an active building of a specific type
 *
 * @param tx - Prisma transaction client or client
 * @param companyId - Company ID
 * @param buildingType - Building type to check
 * @returns True if company has active building of that type
 */
export async function hasActiveBuildingOfType(
  tx: Prisma.TransactionClient | PrismaClient,
  companyId: string,
  buildingType: BuildingType
): Promise<boolean> {
  const count = await tx.building.count({
    where: {
      companyId,
      buildingType,
      status: BuildingStatus.ACTIVE
    }
  });

  return count > 0;
}

/**
 * Gets available production capacity for a company
 *
 * @param tx - Prisma transaction client or client
 * @param companyId - Company ID
 * @returns Object with total capacity and used capacity
 */
export async function getProductionCapacityForCompany(
  tx: Prisma.TransactionClient | PrismaClient,
  companyId: string
): Promise<{ totalCapacity: number; usedCapacity: number }> {
  const productionBuildingTypes = [
    BuildingType.MINE,
    BuildingType.FARM,
    BuildingType.FACTORY,
    BuildingType.MEGA_FACTORY
  ];

  const buildings = await tx.building.findMany({
    where: {
      companyId,
      buildingType: { in: productionBuildingTypes },
      status: BuildingStatus.ACTIVE
    },
    select: {
      capacitySlots: true
    }
  });

  const totalCapacity = buildings.reduce(
    (sum, building) => sum + building.capacitySlots,
    0
  );

  const usedCapacity = await tx.productionJob.count({
    where: {
      companyId,
      status: "IN_PROGRESS"
    }
  });

  return { totalCapacity, usedCapacity };
}

/**
 * Calculates total storage capacity for a region
 *
 * @param warehouseCount - Number of active warehouses in the region
 * @param capacityPerWarehouse - Storage capacity per warehouse (default: WAREHOUSE_CAPACITY_PER_SLOT)
 * @param baseCapacity - Base storage capacity per region (default: BASE_STORAGE_CAPACITY_PER_REGION)
 * @returns Total storage capacity
 *
 * @remarks
 * - Base capacity is the minimum storage available in any region
 * - Each warehouse adds additional capacity based on capacitySlots or fixed amount
 * - Formula: baseCapacity + (warehouseCount * capacityPerWarehouse)
 */
export function calculateRegionalStorageCapacity(
  warehouseCount: number,
  capacityPerWarehouse: number = WAREHOUSE_CAPACITY_PER_SLOT,
  baseCapacity: number = BASE_STORAGE_CAPACITY_PER_REGION
): number {
  if (!Number.isInteger(warehouseCount) || warehouseCount < 0) {
    throw new DomainInvariantError("warehouseCount must be a non-negative integer");
  }
  if (!Number.isInteger(capacityPerWarehouse) || capacityPerWarehouse < 0) {
    throw new DomainInvariantError("capacityPerWarehouse must be a non-negative integer");
  }
  if (!Number.isInteger(baseCapacity) || baseCapacity < 0) {
    throw new DomainInvariantError("baseCapacity must be a non-negative integer");
  }

  return baseCapacity + (warehouseCount * capacityPerWarehouse);
}

/**
 * Validates that adding inventory to a region would not exceed storage capacity
 *
 * @param tx - Prisma transaction client
 * @param companyId - Company ID
 * @param regionId - Region ID
 * @param quantityToAdd - Quantity of inventory to add
 *
 * @throws {DomainInvariantError} If adding inventory would exceed regional storage capacity
 *
 * @remarks
 * - Calculates current total inventory in region (all items combined)
 * - Gets warehouse count to calculate total capacity
 * - Throws error if current + quantityToAdd exceeds capacity
 * - Must be called before any inventory mutation (production, market, shipments)
 */
export async function validateStorageCapacity(
  tx: Prisma.TransactionClient,
  companyId: string,
  regionId: string,
  quantityToAdd: number
): Promise<void> {
  if (!companyId) {
    throw new DomainInvariantError("companyId is required");
  }
  if (!regionId) {
    throw new DomainInvariantError("regionId is required");
  }
  if (!Number.isInteger(quantityToAdd) || quantityToAdd < 0) {
    throw new DomainInvariantError("quantityToAdd must be a non-negative integer");
  }

  // Get current total inventory in region
  const currentInventory = await tx.inventory.aggregate({
    where: { companyId, regionId },
    _sum: { quantity: true }
  });

  // Get warehouse count for capacity calculation
  const warehouseCount = await tx.building.count({
    where: {
      companyId,
      regionId,
      buildingType: BuildingType.WAREHOUSE,
      status: BuildingStatus.ACTIVE
    }
  });

  const capacity = calculateRegionalStorageCapacity(warehouseCount);
  const currentTotal = currentInventory._sum.quantity || 0;

  if (currentTotal + quantityToAdd > capacity) {
    throw new DomainInvariantError(
      `storage capacity exceeded: current=${currentTotal}, adding=${quantityToAdd}, capacity=${capacity}`
    );
  }
}

/**
 * Validates that a company has at least one active production building
 *
 * @param tx - Prisma transaction client
 * @param companyId - Company ID
 *
 * @throws {DomainInvariantError} If company has no active production buildings
 *
 * @remarks
 * - Production buildings include: WORKSHOP, MINE, FARM, FACTORY, MEGA_FACTORY
 * - Only ACTIVE buildings are counted
 * - Must be called before creating production jobs
 */
export async function validateProductionBuildingAvailable(
  tx: Prisma.TransactionClient,
  companyId: string
): Promise<void> {
  if (!companyId) {
    throw new DomainInvariantError("companyId is required");
  }

  const productionBuildingTypes = [
    BuildingType.WORKSHOP,
    BuildingType.MINE,
    BuildingType.FARM,
    BuildingType.FACTORY,
    BuildingType.MEGA_FACTORY
  ];

  const activeBuildingCount = await tx.building.count({
    where: {
      companyId,
      buildingType: { in: productionBuildingTypes },
      status: BuildingStatus.ACTIVE
    }
  });

  if (activeBuildingCount === 0) {
    throw new DomainInvariantError(
      `company ${companyId} has no active production buildings`
    );
  }
}


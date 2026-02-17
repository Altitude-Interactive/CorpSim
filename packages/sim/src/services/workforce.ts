/**
 * Workforce Management Service
 *
 * @module workforce
 *
 * ## Purpose
 * Manages company workforce capacity, allocation, and salary economics. Provides a sophisticated
 * system for allocating workforce across organizational functions (Operations, Research, Logistics,
 * Corporate) with corresponding speed bonuses and efficiency mechanics.
 *
 * ## Key Operations
 * - **Allocate workforce** across Operations (production), Research, Logistics, Corporate functions
 * - **Request workforce capacity changes** (hiring/layoffs) with recruitment costs and arrival delays
 * - **Apply pending hiring arrivals** when ready (after hiringDelayTicks)
 * - **Calculate salary burn** and apply efficiency penalties/recovery per tick
 * - **Resolve runtime modifiers** for production speed, research speed, logistics travel reduction
 *
 * ## Workforce Functions
 * 1. **Operations**: Speeds up production job completion (higher allocation = faster production)
 * 2. **Research**: Speeds up research job completion (higher allocation = faster research)
 * 3. **Logistics**: Reduces shipment travel time (higher allocation = faster delivery)
 * 4. **Corporate**: Maintains organizational efficiency (low allocation → efficiency penalties)
 *
 * ## Allocation Mechanics
 * - Each function gets 0-100% allocation
 * - Total allocation must sum to exactly 100%
 * - Allocation affects duration multipliers for time-based operations
 * - Higher allocation → better performance (lower duration multiplier)
 *
 * ## Organizational Efficiency System
 * Companies track `orgEfficiencyBps` (0-10000 basis points):
 * - **Penalties** (reduce efficiency):
 *   - Layoffs: Immediate penalty (configurable bps per capacity reduced)
 *   - Hiring shock: Gradual penalty over time as new employees onboard
 *   - Low corporate allocation: Penalty when corporate < threshold
 *   - Salary shortfall: Penalty when unable to pay full salaries
 * - **Recovery** (increase efficiency):
 *   - Natural recovery over time with 100% corporate allocation
 *   - Recovery rate: `corporateRecoveryPerTickAt100PctBps` per tick
 *
 * ## Salary and Hiring Economics
 * - **Salary**: `baseSalaryPerCapacity * capacity * regionModifier` per tick
 * - **Recruitment**: Upfront cost of `recruitmentCostPerCapacity * deltaCapacity`
 * - **Hiring Delay**: New capacity arrives after `hiringDelayTicks` ticks
 * - **Constraints**:
 *   - Max absolute delta per request (prevents sudden workforce swings)
 *   - Max relative delta percentage (prevents proportionally large changes)
 *
 * ## Simulation Impact
 * Critical for gameplay - affects:
 * - Production/research speed bonuses (via duration multipliers)
 * - Logistics travel time reduction
 * - Salary cash burn (major operational expense)
 * - Organizational efficiency through penalties and recovery
 *
 * ## Determinism Guarantees
 * - Fully deterministic - all calculations use integer arithmetic
 * - Fixed config parameters ensure reproducible results
 * - Tick-based state progression (no time-of-day dependencies)
 * - Consistent duration multiplier calculations
 *
 * ## Transaction Boundaries
 * - All workforce operations are transactional
 * - Salary deduction, efficiency updates, and hiring arrivals atomic
 * - Uses optimistic locking for concurrent safety
 *
 * ## Error Handling
 * - NotFoundError: Company doesn't exist
 * - DomainInvariantError: Invalid allocation percentages, capacity constraints violated,
 *   insufficient cash for hiring/salaries
 */
import { LedgerEntryType, Prisma, PrismaClient } from "@prisma/client";
import { DomainInvariantError, NotFoundError } from "../domain/errors";

const MAX_BPS = 10_000;
const MAX_PERCENT = 100;

export interface WorkforceRuntimeConfig {
  hiringDelayTicks: number;
  baseSalaryPerCapacityCents: bigint;
  recruitmentCostPerCapacityCents: bigint;
  maxAbsoluteCapacityDeltaPerRequest: number;
  maxRelativeCapacityDeltaPctPerRequest: number;
  layoffEfficiencyPenaltyBps: number;
  hiringShockDurationTicks: number;
  hiringShockPerCapacityBps: number;
  lowCorporateAllocationThresholdPct: number;
  lowCorporatePenaltyBps: number;
  salaryShortfallPenaltyBps: number;
  corporateRecoveryPerTickAt100PctBps: number;
  productionMaxSpeedBonusBps: number;
  researchMaxSpeedBonusBps: number;
  logisticsMaxTravelReductionBps: number;
  regionSalaryModifierBpsByCode: Record<string, number>;
}

export const DEFAULT_WORKFORCE_RUNTIME_CONFIG: WorkforceRuntimeConfig = {
  hiringDelayTicks: 2,
  baseSalaryPerCapacityCents: 2_200n,
  recruitmentCostPerCapacityCents: 8_500n,
  maxAbsoluteCapacityDeltaPerRequest: 250,
  maxRelativeCapacityDeltaPctPerRequest: 50,
  layoffEfficiencyPenaltyBps: 500,
  hiringShockDurationTicks: 2,
  hiringShockPerCapacityBps: 12,
  lowCorporateAllocationThresholdPct: 10,
  lowCorporatePenaltyBps: 70,
  salaryShortfallPenaltyBps: 140,
  corporateRecoveryPerTickAt100PctBps: 120,
  productionMaxSpeedBonusBps: 1_200,
  researchMaxSpeedBonusBps: 1_500,
  logisticsMaxTravelReductionBps: 1_100,
  regionSalaryModifierBpsByCode: {
    CORE: 10_000,
    INDUSTRIAL: 11_000,
    FRONTIER: 9_500
  }
};

export interface WorkforceCompanyState {
  workforceCapacity: number;
  workforceAllocationOpsPct: number;
  workforceAllocationRngPct: number;
  workforceAllocationLogPct: number;
  workforceAllocationCorpPct: number;
  orgEfficiencyBps: number;
}

export interface WorkforceRuntimeModifiers {
  productionSpeedBonusBps: number;
  productionDurationMultiplierBps: number;
  researchSpeedBonusBps: number;
  researchDurationMultiplierBps: number;
  logisticsTravelReductionBps: number;
  logisticsTravelMultiplierBps: number;
}

export interface CompanyWorkforceSnapshot extends WorkforceCompanyState {
  companyId: string;
  weeklySalaryBurnCents: bigint;
  projectedModifiers: WorkforceRuntimeModifiers;
  pendingHiringArrivals: Array<{
    id: string;
    deltaCapacity: number;
    tickArrives: number;
    createdAt: Date;
  }>;
  updatedAt: Date;
}

export interface SetWorkforceAllocationInput {
  companyId: string;
  operationsPct: number;
  researchPct: number;
  logisticsPct: number;
  corporatePct: number;
}

export interface RequestWorkforceCapacityChangeInput {
  companyId: string;
  deltaCapacity: number;
}

export interface RequestWorkforceCapacityChangeResult {
  companyId: string;
  deltaCapacity: number;
  appliedImmediately: boolean;
  tickRequested: number;
  tickArrives: number | null;
  recruitmentCostCents: bigint;
  workforceCapacity: number;
  orgEfficiencyBps: number;
}

function normalizeRegionCode(regionCode: string | undefined | null): string {
  return (regionCode ?? "").trim().toUpperCase();
}

function ensureIntegerInRange(
  value: number,
  fieldName: string,
  min: number,
  max: number
): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new DomainInvariantError(`${fieldName} must be an integer between ${min} and ${max}`);
  }
}

function ensurePositiveInteger(value: number, fieldName: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new DomainInvariantError(`${fieldName} must be a positive integer`);
  }
}

function ensureNonNegativeInteger(value: number, fieldName: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new DomainInvariantError(`${fieldName} must be a non-negative integer`);
  }
}

function ensurePositiveBigInt(value: bigint, fieldName: string): void {
  if (value <= 0n) {
    throw new DomainInvariantError(`${fieldName} must be greater than zero`);
  }
}

function ensureNonNegativeBigInt(value: bigint, fieldName: string): void {
  if (value < 0n) {
    throw new DomainInvariantError(`${fieldName} must be non-negative`);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampEfficiencyBps(value: number): number {
  return clamp(Math.round(value), 0, MAX_BPS);
}

export function assertValidWorkforceAllocation(input: {
  operationsPct: number;
  researchPct: number;
  logisticsPct: number;
  corporatePct: number;
}): void {
  ensureIntegerInRange(input.operationsPct, "operationsPct", 0, MAX_PERCENT);
  ensureIntegerInRange(input.researchPct, "researchPct", 0, MAX_PERCENT);
  ensureIntegerInRange(input.logisticsPct, "logisticsPct", 0, MAX_PERCENT);
  ensureIntegerInRange(input.corporatePct, "corporatePct", 0, MAX_PERCENT);

  const sum =
    input.operationsPct + input.researchPct + input.logisticsPct + input.corporatePct;
  if (sum !== 100) {
    throw new DomainInvariantError("workforce allocation percentages must sum to 100");
  }
}

function assertValidWorkforceState(state: WorkforceCompanyState): void {
  ensureNonNegativeInteger(state.workforceCapacity, "workforceCapacity");
  ensureIntegerInRange(state.orgEfficiencyBps, "orgEfficiencyBps", 0, MAX_BPS);
  assertValidWorkforceAllocation({
    operationsPct: state.workforceAllocationOpsPct,
    researchPct: state.workforceAllocationRngPct,
    logisticsPct: state.workforceAllocationLogPct,
    corporatePct: state.workforceAllocationCorpPct
  });
}

export function resolveWorkforceRuntimeConfig(
  overrides: Partial<WorkforceRuntimeConfig> = {}
): WorkforceRuntimeConfig {
  const config: WorkforceRuntimeConfig = {
    ...DEFAULT_WORKFORCE_RUNTIME_CONFIG,
    ...overrides,
    regionSalaryModifierBpsByCode: {
      ...DEFAULT_WORKFORCE_RUNTIME_CONFIG.regionSalaryModifierBpsByCode,
      ...(overrides.regionSalaryModifierBpsByCode ?? {})
    }
  };

  ensurePositiveInteger(config.hiringDelayTicks, "hiringDelayTicks");
  ensurePositiveBigInt(config.baseSalaryPerCapacityCents, "baseSalaryPerCapacityCents");
  ensurePositiveBigInt(
    config.recruitmentCostPerCapacityCents,
    "recruitmentCostPerCapacityCents"
  );
  ensurePositiveInteger(
    config.maxAbsoluteCapacityDeltaPerRequest,
    "maxAbsoluteCapacityDeltaPerRequest"
  );
  ensureIntegerInRange(
    config.maxRelativeCapacityDeltaPctPerRequest,
    "maxRelativeCapacityDeltaPctPerRequest",
    1,
    MAX_PERCENT
  );
  ensureNonNegativeInteger(config.layoffEfficiencyPenaltyBps, "layoffEfficiencyPenaltyBps");
  ensurePositiveInteger(config.hiringShockDurationTicks, "hiringShockDurationTicks");
  ensureNonNegativeInteger(config.hiringShockPerCapacityBps, "hiringShockPerCapacityBps");
  ensureIntegerInRange(
    config.lowCorporateAllocationThresholdPct,
    "lowCorporateAllocationThresholdPct",
    0,
    MAX_PERCENT
  );
  ensureNonNegativeInteger(config.lowCorporatePenaltyBps, "lowCorporatePenaltyBps");
  ensureNonNegativeInteger(config.salaryShortfallPenaltyBps, "salaryShortfallPenaltyBps");
  ensureNonNegativeInteger(
    config.corporateRecoveryPerTickAt100PctBps,
    "corporateRecoveryPerTickAt100PctBps"
  );
  ensureIntegerInRange(config.productionMaxSpeedBonusBps, "productionMaxSpeedBonusBps", 0, MAX_BPS);
  ensureIntegerInRange(config.researchMaxSpeedBonusBps, "researchMaxSpeedBonusBps", 0, MAX_BPS);
  ensureIntegerInRange(
    config.logisticsMaxTravelReductionBps,
    "logisticsMaxTravelReductionBps",
    0,
    MAX_BPS
  );

  for (const [regionCode, modifierBps] of Object.entries(config.regionSalaryModifierBpsByCode)) {
    ensurePositiveInteger(modifierBps, `regionSalaryModifierBpsByCode.${regionCode}`);
  }

  return config;
}

function resolveFunctionBonusBps(
  allocationPct: number,
  orgEfficiencyBps: number,
  maxBonusBps: number,
  workforceCapacity: number
): number {
  if (workforceCapacity <= 0 || maxBonusBps <= 0) {
    return 0;
  }

  const scaled = Math.floor(
    (allocationPct * orgEfficiencyBps * maxBonusBps) / (MAX_PERCENT * MAX_BPS)
  );
  return clamp(scaled, 0, maxBonusBps);
}

export function resolveWorkforceRuntimeModifiers(
  state: WorkforceCompanyState,
  overrides: Partial<WorkforceRuntimeConfig> = {}
): WorkforceRuntimeModifiers {
  const config = resolveWorkforceRuntimeConfig(overrides);
  assertValidWorkforceState(state);

  const productionSpeedBonusBps = resolveFunctionBonusBps(
    state.workforceAllocationOpsPct,
    state.orgEfficiencyBps,
    config.productionMaxSpeedBonusBps,
    state.workforceCapacity
  );
  const researchSpeedBonusBps = resolveFunctionBonusBps(
    state.workforceAllocationRngPct,
    state.orgEfficiencyBps,
    config.researchMaxSpeedBonusBps,
    state.workforceCapacity
  );
  const logisticsTravelReductionBps = resolveFunctionBonusBps(
    state.workforceAllocationLogPct,
    state.orgEfficiencyBps,
    config.logisticsMaxTravelReductionBps,
    state.workforceCapacity
  );

  return {
    productionSpeedBonusBps,
    productionDurationMultiplierBps: MAX_BPS - productionSpeedBonusBps,
    researchSpeedBonusBps,
    researchDurationMultiplierBps: MAX_BPS - researchSpeedBonusBps,
    logisticsTravelReductionBps,
    logisticsTravelMultiplierBps: MAX_BPS - logisticsTravelReductionBps
  };
}

export function applyDurationMultiplierTicks(
  durationTicks: number,
  durationMultiplierBps: number
): number {
  ensureNonNegativeInteger(durationTicks, "durationTicks");
  ensureIntegerInRange(durationMultiplierBps, "durationMultiplierBps", 1, MAX_BPS);
  if (durationTicks === 0) {
    return 0;
  }
  return Math.max(1, Math.floor((durationTicks * durationMultiplierBps + (MAX_BPS - 1)) / MAX_BPS));
}

function resolveRegionSalaryModifierBps(
  regionCode: string | undefined | null,
  config: WorkforceRuntimeConfig
): number {
  const normalizedRegionCode = normalizeRegionCode(regionCode);
  if (!normalizedRegionCode) {
    return MAX_BPS;
  }

  return config.regionSalaryModifierBpsByCode[normalizedRegionCode] ?? MAX_BPS;
}

export function resolveWeeklyWorkforceSalaryBurnCents(
  workforceCapacity: number,
  regionCode: string | undefined | null,
  overrides: Partial<WorkforceRuntimeConfig> = {}
): bigint {
  ensureNonNegativeInteger(workforceCapacity, "workforceCapacity");
  const config = resolveWorkforceRuntimeConfig(overrides);
  const regionSalaryModifierBps = resolveRegionSalaryModifierBps(regionCode, config);
  const gross = BigInt(workforceCapacity) * config.baseSalaryPerCapacityCents;
  return (gross * BigInt(regionSalaryModifierBps)) / BigInt(MAX_BPS);
}

async function resolveCurrentTick(tx: Prisma.TransactionClient): Promise<number> {
  const world = await tx.worldTickState.findUnique({
    where: { id: 1 },
    select: { currentTick: true }
  });
  return world?.currentTick ?? 0;
}

export async function getCompanyWorkforce(
  prisma: PrismaClient | Prisma.TransactionClient,
  companyId: string
): Promise<CompanyWorkforceSnapshot> {
  if (!companyId) {
    throw new DomainInvariantError("companyId is required");
  }

  const [company, pending] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        workforceCapacity: true,
        workforceAllocationOpsPct: true,
        workforceAllocationRngPct: true,
        workforceAllocationLogPct: true,
        workforceAllocationCorpPct: true,
        orgEfficiencyBps: true,
        updatedAt: true,
        region: {
          select: {
            code: true
          }
        }
      }
    }),
    prisma.workforceCapacityDelta.findMany({
      where: {
        companyId,
        tickApplied: null,
        deltaCapacity: {
          gt: 0
        }
      },
      orderBy: [{ tickArrives: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        deltaCapacity: true,
        tickArrives: true,
        createdAt: true
      }
    })
  ]);

  if (!company) {
    throw new NotFoundError(`company ${companyId} not found`);
  }

  const state: WorkforceCompanyState = {
    workforceCapacity: company.workforceCapacity,
    workforceAllocationOpsPct: company.workforceAllocationOpsPct,
    workforceAllocationRngPct: company.workforceAllocationRngPct,
    workforceAllocationLogPct: company.workforceAllocationLogPct,
    workforceAllocationCorpPct: company.workforceAllocationCorpPct,
    orgEfficiencyBps: company.orgEfficiencyBps
  };
  assertValidWorkforceState(state);

  return {
    companyId: company.id,
    ...state,
    weeklySalaryBurnCents: resolveWeeklyWorkforceSalaryBurnCents(
      company.workforceCapacity,
      company.region.code
    ),
    projectedModifiers: resolveWorkforceRuntimeModifiers(state),
    pendingHiringArrivals: pending,
    updatedAt: company.updatedAt
  };
}

export async function setCompanyWorkforceAllocation(
  prisma: PrismaClient,
  input: SetWorkforceAllocationInput
): Promise<CompanyWorkforceSnapshot> {
  if (!input.companyId) {
    throw new DomainInvariantError("companyId is required");
  }
  assertValidWorkforceAllocation({
    operationsPct: input.operationsPct,
    researchPct: input.researchPct,
    logisticsPct: input.logisticsPct,
    corporatePct: input.corporatePct
  });

  return prisma.$transaction(async (tx) => {
    const company = await tx.company.findUnique({
      where: { id: input.companyId },
      select: { id: true }
    });
    if (!company) {
      throw new NotFoundError(`company ${input.companyId} not found`);
    }

    await tx.company.update({
      where: {
        id: input.companyId
      },
      data: {
        workforceAllocationOpsPct: input.operationsPct,
        workforceAllocationRngPct: input.researchPct,
        workforceAllocationLogPct: input.logisticsPct,
        workforceAllocationCorpPct: input.corporatePct
      }
    });

    return getCompanyWorkforce(tx, input.companyId);
  });
}

export async function requestCompanyWorkforceCapacityChange(
  prisma: PrismaClient,
  input: RequestWorkforceCapacityChangeInput,
  overrides: Partial<WorkforceRuntimeConfig> = {}
): Promise<RequestWorkforceCapacityChangeResult> {
  if (!input.companyId) {
    throw new DomainInvariantError("companyId is required");
  }
  if (!Number.isInteger(input.deltaCapacity) || input.deltaCapacity === 0) {
    throw new DomainInvariantError("deltaCapacity must be a non-zero integer");
  }

  const config = resolveWorkforceRuntimeConfig(overrides);

  return prisma.$transaction(async (tx) => {
    const company = await tx.company.findUnique({
      where: {
        id: input.companyId
      },
      select: {
        id: true,
        cashCents: true,
        reservedCashCents: true,
        workforceCapacity: true,
        workforceAllocationOpsPct: true,
        workforceAllocationRngPct: true,
        workforceAllocationLogPct: true,
        workforceAllocationCorpPct: true,
        orgEfficiencyBps: true
      }
    });
    if (!company) {
      throw new NotFoundError(`company ${input.companyId} not found`);
    }

    assertValidWorkforceState({
      workforceCapacity: company.workforceCapacity,
      workforceAllocationOpsPct: company.workforceAllocationOpsPct,
      workforceAllocationRngPct: company.workforceAllocationRngPct,
      workforceAllocationLogPct: company.workforceAllocationLogPct,
      workforceAllocationCorpPct: company.workforceAllocationCorpPct,
      orgEfficiencyBps: company.orgEfficiencyBps
    });

    const deltaAbs = Math.abs(input.deltaCapacity);
    if (deltaAbs > config.maxAbsoluteCapacityDeltaPerRequest) {
      throw new DomainInvariantError(
        `deltaCapacity exceeds absolute max ${config.maxAbsoluteCapacityDeltaPerRequest}`
      );
    }

    if (company.workforceCapacity > 0) {
      const relativeMax = Math.max(
        1,
        Math.floor(
          (company.workforceCapacity * config.maxRelativeCapacityDeltaPctPerRequest) / MAX_PERCENT
        )
      );
      if (deltaAbs > relativeMax) {
        throw new DomainInvariantError(
          `deltaCapacity exceeds relative max of ${config.maxRelativeCapacityDeltaPctPerRequest}%`
        );
      }
    }

    const tickRequested = await resolveCurrentTick(tx);

    if (input.deltaCapacity < 0) {
      if (deltaAbs > company.workforceCapacity) {
        throw new DomainInvariantError("cannot reduce workforce below zero");
      }

      const nextCapacity = company.workforceCapacity - deltaAbs;
      const nextEfficiency = clampEfficiencyBps(
        company.orgEfficiencyBps - config.layoffEfficiencyPenaltyBps
      );

      await tx.company.update({
        where: { id: company.id },
        data: {
          workforceCapacity: nextCapacity,
          orgEfficiencyBps: nextEfficiency
        }
      });

      return {
        companyId: company.id,
        deltaCapacity: input.deltaCapacity,
        appliedImmediately: true,
        tickRequested,
        tickArrives: null,
        recruitmentCostCents: 0n,
        workforceCapacity: nextCapacity,
        orgEfficiencyBps: nextEfficiency
      };
    }

    const recruitmentCostCents =
      BigInt(input.deltaCapacity) * config.recruitmentCostPerCapacityCents;
    ensureNonNegativeBigInt(recruitmentCostCents, "recruitmentCostCents");

    const availableCash = company.cashCents - company.reservedCashCents;
    if (availableCash < recruitmentCostCents) {
      throw new DomainInvariantError("insufficient available cash for recruitment expense");
    }

    const nextCashCents = company.cashCents - recruitmentCostCents;
    const tickArrives = tickRequested + config.hiringDelayTicks;

    const created = await tx.workforceCapacityDelta.create({
      data: {
        companyId: company.id,
        deltaCapacity: input.deltaCapacity,
        tickArrives
      },
      select: {
        id: true
      }
    });

    await tx.company.update({
      where: {
        id: company.id
      },
      data: {
        cashCents: nextCashCents
      }
    });

    await tx.ledgerEntry.create({
      data: {
        companyId: company.id,
        tick: tickRequested,
        entryType: LedgerEntryType.WORKFORCE_RECRUITMENT_EXPENSE,
        deltaCashCents: -recruitmentCostCents,
        deltaReservedCashCents: 0n,
        balanceAfterCents: nextCashCents,
        referenceType: "WORKFORCE_CAPACITY_CHANGE",
        referenceId: created.id
      }
    });

    return {
      companyId: company.id,
      deltaCapacity: input.deltaCapacity,
      appliedImmediately: false,
      tickRequested,
      tickArrives,
      recruitmentCostCents,
      workforceCapacity: company.workforceCapacity,
      orgEfficiencyBps: company.orgEfficiencyBps
    };
  });
}

async function applyDueWorkforceCapacityDeltas(
  tx: Prisma.TransactionClient,
  tick: number
): Promise<void> {
  const dueDeltas = await tx.workforceCapacityDelta.findMany({
    where: {
      tickApplied: null,
      tickArrives: {
        lte: tick
      }
    },
    orderBy: [{ tickArrives: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      companyId: true,
      deltaCapacity: true
    }
  });

  for (const delta of dueDeltas) {
    if (delta.deltaCapacity <= 0) {
      throw new DomainInvariantError(
        `workforce capacity delta ${delta.id} must be positive when pending`
      );
    }

    const claimed = await tx.workforceCapacityDelta.updateMany({
      where: {
        id: delta.id,
        tickApplied: null
      },
      data: {
        tickApplied: tick
      }
    });

    if (claimed.count !== 1) {
      continue;
    }

    await tx.company.update({
      where: {
        id: delta.companyId
      },
      data: {
        workforceCapacity: {
          increment: delta.deltaCapacity
        }
      }
    });
  }
}

export async function runWorkforceForTick(
  tx: Prisma.TransactionClient,
  tick: number,
  overrides: Partial<WorkforceRuntimeConfig> = {}
): Promise<void> {
  ensureNonNegativeInteger(tick, "tick");
  const config = resolveWorkforceRuntimeConfig(overrides);

  await applyDueWorkforceCapacityDeltas(tx, tick);

  const recentHiringStartTick = Math.max(0, tick - config.hiringShockDurationTicks + 1);
  const [companies, recentHiring] = await Promise.all([
    tx.company.findMany({
      orderBy: {
        id: "asc"
      },
      select: {
        id: true,
        cashCents: true,
        reservedCashCents: true,
        workforceCapacity: true,
        workforceAllocationOpsPct: true,
        workforceAllocationRngPct: true,
        workforceAllocationLogPct: true,
        workforceAllocationCorpPct: true,
        orgEfficiencyBps: true,
        region: {
          select: {
            code: true
          }
        }
      }
    }),
    tx.workforceCapacityDelta.groupBy({
      by: ["companyId"],
      where: {
        deltaCapacity: {
          gt: 0
        },
        tickApplied: {
          gte: recentHiringStartTick,
          lte: tick
        }
      },
      _sum: {
        deltaCapacity: true
      }
    })
  ]);

  const recentHiringByCompanyId = new Map(
    recentHiring.map((entry) => [entry.companyId, entry._sum.deltaCapacity ?? 0])
  );

  for (const company of companies) {
    assertValidWorkforceState({
      workforceCapacity: company.workforceCapacity,
      workforceAllocationOpsPct: company.workforceAllocationOpsPct,
      workforceAllocationRngPct: company.workforceAllocationRngPct,
      workforceAllocationLogPct: company.workforceAllocationLogPct,
      workforceAllocationCorpPct: company.workforceAllocationCorpPct,
      orgEfficiencyBps: company.orgEfficiencyBps
    });

    const salaryDueCents = resolveWeeklyWorkforceSalaryBurnCents(
      company.workforceCapacity,
      company.region.code,
      config
    );

    const availableCash = company.cashCents - company.reservedCashCents;
    const spendableCash = availableCash > 0n ? availableCash : 0n;
    const salaryPaidCents = salaryDueCents <= spendableCash ? salaryDueCents : spendableCash;
    const cashAfterCents = company.cashCents - salaryPaidCents;

    const recentHiringCapacity = recentHiringByCompanyId.get(company.id) ?? 0;
    const hiringShockPenaltyBps = recentHiringCapacity * config.hiringShockPerCapacityBps;
    const lowCorporatePenaltyBps =
      company.workforceAllocationCorpPct < config.lowCorporateAllocationThresholdPct
        ? config.lowCorporatePenaltyBps
        : 0;
    const salaryShortfallPenaltyBps =
      salaryPaidCents < salaryDueCents ? config.salaryShortfallPenaltyBps : 0;
    const recoveryBps = Math.floor(
      (company.workforceAllocationCorpPct * config.corporateRecoveryPerTickAt100PctBps) /
        MAX_PERCENT
    );

    const nextEfficiencyBps = clampEfficiencyBps(
      company.orgEfficiencyBps -
        hiringShockPenaltyBps -
        lowCorporatePenaltyBps -
        salaryShortfallPenaltyBps +
        recoveryBps
    );

    await tx.company.update({
      where: { id: company.id },
      data: {
        cashCents: cashAfterCents,
        orgEfficiencyBps: nextEfficiencyBps
      }
    });

    await tx.ledgerEntry.create({
      data: {
        companyId: company.id,
        tick,
        entryType: LedgerEntryType.WORKFORCE_SALARY_EXPENSE,
        deltaCashCents: -salaryPaidCents,
        deltaReservedCashCents: 0n,
        balanceAfterCents: cashAfterCents,
        referenceType: "WORKFORCE_SALARY",
        referenceId: `${company.id}:${tick}`
      }
    });
  }
}

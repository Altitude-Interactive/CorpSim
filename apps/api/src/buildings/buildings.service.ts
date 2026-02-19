import { Inject, Injectable } from "@nestjs/common";
import { BuildingStatus, BuildingType } from "@prisma/client";
import type {
  BuildingRecord,
  RegionalStorageInfo,
  ProductionCapacityInfo,
  PreflightValidationResult,
  ValidationIssue,
  BuildingTypeDefinition
} from "@corpsim/shared";
import {
  assertCompanyOwnedByPlayer,
  resolvePlayerById,
  acquireBuildingWithTx,
  reactivateBuildingWithTx,
  getProductionCapacityForCompany,
  calculateRegionalStorageCapacity,
  WAREHOUSE_CAPACITY_PER_SLOT
} from "@corpsim/sim";
import { PrismaService } from "../prisma/prisma.service";
import { WorldService } from "../world/world.service";

// Building type definitions with costs (Phase 5 balance pass)
const BUILDING_DEFINITIONS: Record<BuildingType, Omit<BuildingTypeDefinition, "buildingType">> = {
  [BuildingType.MINE]: {
    category: "PRODUCTION",
    name: "Mine",
    description: "Extract raw materials from the earth",
    acquisitionCostCents: "10000000", // $100,000
    weeklyOperatingCostCents: "500000", // $5,000/week
    capacitySlots: 2
  },
  [BuildingType.FARM]: {
    category: "PRODUCTION",
    name: "Farm",
    description: "Grow and harvest agricultural products",
    acquisitionCostCents: "8000000", // $80,000
    weeklyOperatingCostCents: "400000", // $4,000/week
    capacitySlots: 2
  },
  [BuildingType.FACTORY]: {
    category: "PRODUCTION",
    name: "Factory",
    description: "Process materials into finished goods",
    acquisitionCostCents: "25000000", // $250,000
    weeklyOperatingCostCents: "1200000", // $12,000/week
    capacitySlots: 3
  },
  [BuildingType.MEGA_FACTORY]: {
    category: "PRODUCTION",
    name: "Mega Factory",
    description: "High-capacity industrial production facility",
    acquisitionCostCents: "100000000", // $1,000,000
    weeklyOperatingCostCents: "5000000", // $50,000/week
    capacitySlots: 10
  },
  [BuildingType.WAREHOUSE]: {
    category: "STORAGE",
    name: "Warehouse",
    description: "Store inventory beyond base capacity",
    acquisitionCostCents: "15000000", // $150,000
    weeklyOperatingCostCents: "800000", // $8,000/week
    capacitySlots: 1,
    storageCapacity: WAREHOUSE_CAPACITY_PER_SLOT
  },
  [BuildingType.HEADQUARTERS]: {
    category: "CORPORATE",
    name: "Headquarters",
    description: "Corporate management and strategic operations",
    acquisitionCostCents: "50000000", // $500,000
    weeklyOperatingCostCents: "2500000", // $25,000/week
    capacitySlots: 1
  },
  [BuildingType.RND_CENTER]: {
    category: "CORPORATE",
    name: "R&D Center",
    description: "Research and development facility",
    acquisitionCostCents: "30000000", // $300,000
    weeklyOperatingCostCents: "1500000", // $15,000/week
    capacitySlots: 1
  }
};

function mapBuildingToDto(building: {
  id: string;
  companyId: string;
  regionId: string;
  buildingType: BuildingType;
  status: BuildingStatus;
  name: string | null;
  acquisitionCostCents: bigint;
  weeklyOperatingCostCents: bigint;
  capacitySlots: number;
  tickAcquired: number;
  tickConstructionCompletes: number | null;
  lastOperatingCostTick: number | null;
  createdAt: Date;
  updatedAt: Date;
  region: {
    id: string;
    code: string;
    name: string;
  };
}): BuildingRecord {
  return {
    id: building.id,
    companyId: building.companyId,
    regionId: building.regionId,
    buildingType: building.buildingType as BuildingType,
    status: building.status as BuildingStatus,
    name: building.name,
    acquisitionCostCents: building.acquisitionCostCents.toString(),
    weeklyOperatingCostCents: building.weeklyOperatingCostCents.toString(),
    capacitySlots: building.capacitySlots,
    tickAcquired: building.tickAcquired,
    tickConstructionCompletes: building.tickConstructionCompletes,
    lastOperatingCostTick: building.lastOperatingCostTick,
    createdAt: building.createdAt.toISOString(),
    updatedAt: building.updatedAt.toISOString(),
    region: {
      id: building.region.id,
      code: building.region.code,
      name: building.region.name
    }
  };
}

@Injectable()
export class BuildingsService {
  private readonly prisma: PrismaService;
  private readonly worldService: WorldService;

  constructor(
    @Inject(PrismaService) prisma: PrismaService,
    @Inject(WorldService) worldService: WorldService
  ) {
    this.prisma = prisma;
    this.worldService = worldService;
  }

  async listBuildings(
    filters: { companyId: string; regionId?: string; status?: BuildingStatus },
    playerId: string
  ): Promise<BuildingRecord[]> {
    const player = await resolvePlayerById(this.prisma, playerId);
    await assertCompanyOwnedByPlayer(this.prisma, player.id, filters.companyId);

    const buildings = await this.prisma.building.findMany({
      where: {
        companyId: filters.companyId,
        ...(filters.regionId && { regionId: filters.regionId }),
        ...(filters.status && { status: filters.status })
      },
      include: {
        region: {
          select: {
            id: true,
            code: true,
            name: true
          }
        }
      },
      orderBy: [
        { regionId: "asc" },
        { buildingType: "asc" },
        { createdAt: "asc" }
      ]
    });

    return buildings.map(mapBuildingToDto);
  }

  async acquireBuilding(
    input: { companyId: string; regionId: string; buildingType: BuildingType; name?: string },
    playerId: string
  ): Promise<BuildingRecord> {
    const player = await resolvePlayerById(this.prisma, playerId);
    await assertCompanyOwnedByPlayer(this.prisma, player.id, input.companyId);

    const definition = BUILDING_DEFINITIONS[input.buildingType];
    if (!definition) {
      throw new Error(`Unknown building type: ${input.buildingType}`);
    }

    const worldState = await this.worldService.getTickState();
    const currentTick = worldState.currentTick;

    const building = await this.prisma.$transaction(async (tx) => {
      return acquireBuildingWithTx(tx, {
        companyId: input.companyId,
        regionId: input.regionId,
        buildingType: input.buildingType,
        name: input.name,
        acquisitionCostCents: BigInt(definition.acquisitionCostCents),
        weeklyOperatingCostCents: BigInt(definition.weeklyOperatingCostCents),
        capacitySlots: definition.capacitySlots,
        tick: currentTick
      });
    });

    const buildingWithRegion = await this.prisma.building.findUniqueOrThrow({
      where: { id: building.id },
      include: {
        region: {
          select: {
            id: true,
            code: true,
            name: true
          }
        }
      }
    });

    return mapBuildingToDto(buildingWithRegion);
  }

  async reactivateBuilding(
    buildingId: string,
    playerId: string
  ): Promise<BuildingRecord> {
    // Verify ownership
    const building = await this.prisma.building.findUniqueOrThrow({
      where: { id: buildingId },
      select: { companyId: true }
    });

    const player = await resolvePlayerById(this.prisma, playerId);
    await assertCompanyOwnedByPlayer(this.prisma, player.id, building.companyId);

    const worldState = await this.worldService.getTickState();
    const currentTick = worldState.currentTick;

    const reactivated = await this.prisma.$transaction(async (tx) => {
      return reactivateBuildingWithTx(tx, {
        buildingId,
        tick: currentTick
      });
    });

    const buildingWithRegion = await this.prisma.building.findUniqueOrThrow({
      where: { id: reactivated.id },
      include: {
        region: {
          select: {
            id: true,
            code: true,
            name: true
          }
        }
      }
    });

    return mapBuildingToDto(buildingWithRegion);
  }

  async getRegionalStorageInfo(
    companyId: string,
    regionId: string,
    playerId: string
  ): Promise<RegionalStorageInfo> {
    const player = await resolvePlayerById(this.prisma, playerId);
    await assertCompanyOwnedByPlayer(this.prisma, player.id, companyId);

    const [currentInventory, warehouseCount] = await Promise.all([
      this.prisma.inventory.aggregate({
        where: { companyId, regionId },
        _sum: { quantity: true }
      }),
      this.prisma.building.count({
        where: {
          companyId,
          regionId,
          buildingType: BuildingType.WAREHOUSE,
          status: BuildingStatus.ACTIVE
        }
      })
    ]);

    const maxCapacity = calculateRegionalStorageCapacity(warehouseCount);
    const currentUsage = currentInventory._sum.quantity || 0;
    const usagePercentage = maxCapacity > 0 ? (currentUsage / maxCapacity) * 100 : 0;

    return {
      companyId,
      regionId,
      currentUsage,
      maxCapacity,
      usagePercentage,
      warehouseCount
    };
  }

  async getProductionCapacityInfo(
    companyId: string,
    playerId: string
  ): Promise<ProductionCapacityInfo> {
    const player = await resolvePlayerById(this.prisma, playerId);
    await assertCompanyOwnedByPlayer(this.prisma, player.id, companyId);

    const capacityInfo = await getProductionCapacityForCompany(this.prisma, companyId);

    return {
      companyId,
      totalCapacity: capacityInfo.totalCapacity,
      usedCapacity: capacityInfo.usedCapacity,
      availableCapacity: capacityInfo.totalCapacity - capacityInfo.usedCapacity,
      usagePercentage:
        capacityInfo.totalCapacity > 0
          ? (capacityInfo.usedCapacity / capacityInfo.totalCapacity) * 100
          : 0
    };
  }

  async preflightProductionJob(
    input: { companyId: string; recipeId: string; quantity: number },
    playerId: string
  ): Promise<PreflightValidationResult> {
    const player = await resolvePlayerById(this.prisma, playerId);
    await assertCompanyOwnedByPlayer(this.prisma, player.id, input.companyId);

    const issues: ValidationIssue[] = [];

    try {
      // Check for active production buildings
      const productionBuildingTypes = [
        BuildingType.MINE,
        BuildingType.FARM,
        BuildingType.FACTORY,
        BuildingType.MEGA_FACTORY
      ];

      const activeBuildingCount = await this.prisma.building.count({
        where: {
          companyId: input.companyId,
          buildingType: { in: productionBuildingTypes },
          status: BuildingStatus.ACTIVE
        }
      });

      if (activeBuildingCount === 0) {
        issues.push({
          code: "NO_ACTIVE_BUILDING",
          message: "No active production buildings available",
          severity: "ERROR"
        });
      }

      // Check production capacity
      const capacityInfo = await getProductionCapacityForCompany(
        this.prisma,
        input.companyId
      );

      if (capacityInfo.usedCapacity >= capacityInfo.totalCapacity) {
        issues.push({
          code: "BUILDING_CAPACITY_FULL",
          message: `Production capacity full: ${capacityInfo.usedCapacity}/${capacityInfo.totalCapacity} slots used`,
          severity: "ERROR"
        });
      }

      // Check storage capacity for output
      const recipe = await this.prisma.recipe.findUnique({
        where: { id: input.recipeId },
        include: { outputItem: true }
      });

      if (recipe) {
        const company = await this.prisma.company.findUnique({
          where: { id: input.companyId },
          select: { regionId: true }
        });

        if (company) {
          const outputQuantity = recipe.outputQuantity * input.quantity;
          const currentInventory = await this.prisma.inventory.aggregate({
            where: { companyId: input.companyId, regionId: company.regionId },
            _sum: { quantity: true }
          });

          const warehouseCount = await this.prisma.building.count({
            where: {
              companyId: input.companyId,
              regionId: company.regionId,
              buildingType: BuildingType.WAREHOUSE,
              status: BuildingStatus.ACTIVE
            }
          });

          const capacity = calculateRegionalStorageCapacity(warehouseCount);
          const currentTotal = currentInventory._sum.quantity || 0;

          if (currentTotal + outputQuantity > capacity) {
            issues.push({
              code: "INSUFFICIENT_STORAGE",
              message: `Insufficient storage: need ${currentTotal + outputQuantity}, capacity ${capacity}`,
              severity: "ERROR"
            });
          } else if (currentTotal + outputQuantity > capacity * 0.8) {
            issues.push({
              code: "STORAGE_WARNING",
              message: `Storage will be ${Math.round(((currentTotal + outputQuantity) / capacity) * 100)}% full after production`,
              severity: "WARNING"
            });
          }
        }
      }
    } catch (error) {
      issues.push({
        code: "VALIDATION_ERROR",
        message: error instanceof Error ? error.message : "Unknown validation error",
        severity: "ERROR"
      });
    }

    return {
      valid: !issues.some((issue) => issue.severity === "ERROR"),
      issues
    };
  }

  async preflightBuyOrder(
    input: { companyId: string; regionId: string; itemId: string; quantity: number },
    playerId: string
  ): Promise<PreflightValidationResult> {
    const player = await resolvePlayerById(this.prisma, playerId);
    await assertCompanyOwnedByPlayer(this.prisma, player.id, input.companyId);

    const issues: ValidationIssue[] = [];

    try {
      // Check storage capacity
      const currentInventory = await this.prisma.inventory.aggregate({
        where: { companyId: input.companyId, regionId: input.regionId },
        _sum: { quantity: true }
      });

      const warehouseCount = await this.prisma.building.count({
        where: {
          companyId: input.companyId,
          regionId: input.regionId,
          buildingType: BuildingType.WAREHOUSE,
          status: BuildingStatus.ACTIVE
        }
      });

      const capacity = calculateRegionalStorageCapacity(warehouseCount);
      const currentTotal = currentInventory._sum.quantity || 0;

      if (currentTotal + input.quantity > capacity) {
        issues.push({
          code: "INSUFFICIENT_STORAGE",
          message: `Insufficient storage: need ${currentTotal + input.quantity}, capacity ${capacity}`,
          severity: "ERROR"
        });
      } else if (currentTotal + input.quantity > capacity * 0.95) {
        issues.push({
          code: "STORAGE_CRITICAL",
          message: `Storage will be ${Math.round(((currentTotal + input.quantity) / capacity) * 100)}% full after purchase`,
          severity: "WARNING"
        });
      } else if (currentTotal + input.quantity > capacity * 0.8) {
        issues.push({
          code: "STORAGE_WARNING",
          message: `Storage will be ${Math.round(((currentTotal + input.quantity) / capacity) * 100)}% full after purchase`,
          severity: "WARNING"
        });
      }
    } catch (error) {
      issues.push({
        code: "VALIDATION_ERROR",
        message: error instanceof Error ? error.message : "Unknown validation error",
        severity: "ERROR"
      });
    }

    return {
      valid: !issues.some((issue) => issue.severity === "ERROR"),
      issues
    };
  }

  async getBuildingTypeDefinitions(): Promise<BuildingTypeDefinition[]> {
    return Object.entries(BUILDING_DEFINITIONS).map(([buildingType, definition]) => ({
      buildingType: buildingType as BuildingType,
      ...definition
    }));
  }
}

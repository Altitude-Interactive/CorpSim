import { Inject, Injectable } from "@nestjs/common";
import { DomainInvariantError, resolvePlayerById } from "@corpsim/sim";
import type { OnboardingStatus } from "@corpsim/shared";
import { PrismaService } from "../prisma/prisma.service";

interface CompleteOnboardingInput {
  playerId: string;
  companyName: string;
  regionId?: string;
}

const STARTING_CASH_CENTS = 1_200_000n;
const STARTER_INVENTORY = [
  { code: "IRON_ORE", quantity: 240 },
  { code: "COAL", quantity: 140 },
  { code: "COPPER_ORE", quantity: 180 },
  { code: "IRON_INGOT", quantity: 12 },
  { code: "COPPER_INGOT", quantity: 6 }
] as const;

function normalizeCompanyCodeSeed(name: string): string {
  const normalized = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (normalized.length === 0) {
    return "PLAYER_CO";
  }

  return normalized.slice(0, 18);
}

function isDefaultUnlockedRecipe(code: string): boolean {
  return code === "SMELT_IRON" || code === "SMELT_COPPER" || code.startsWith("FABRICATE_CP_");
}

@Injectable()
export class OnboardingService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  private async getOwnedCompany(playerId: string) {
    return this.prisma.company.findFirst({
      where: { ownerPlayerId: playerId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        regionId: true
      }
    });
  }

  async getStatus(playerId: string): Promise<OnboardingStatus> {
    await resolvePlayerById(this.prisma, playerId);
    const company = await this.getOwnedCompany(playerId);
    return {
      completed: Boolean(company),
      companyId: company?.id ?? null,
      companyName: company?.name ?? null,
      regionId: company?.regionId ?? null
    };
  }

  async complete(input: CompleteOnboardingInput): Promise<OnboardingStatus> {
    const player = await resolvePlayerById(this.prisma, input.playerId);
    const companyName = input.companyName.trim();
    if (companyName.length < 2) {
      throw new DomainInvariantError("company name must be at least 2 characters");
    }

    const existingCompany = await this.getOwnedCompany(player.id);
    if (existingCompany) {
      return {
        completed: true,
        companyId: existingCompany.id,
        companyName: existingCompany.name,
        regionId: existingCompany.regionId
      };
    }

    return this.prisma.$transaction(async (tx) => {
      const duplicateName = await tx.company.findFirst({
        where: {
          name: {
            equals: companyName,
            mode: "insensitive"
          }
        },
        select: {
          id: true
        }
      });
      if (duplicateName) {
        throw new DomainInvariantError("company name is already in use");
      }

      const chosenRegion = input.regionId
        ? await tx.region.findUnique({
            where: { id: input.regionId },
            select: { id: true }
          })
        : await tx.region.findFirst({
            where: { code: "CORE" },
            select: { id: true }
          });

      if (!chosenRegion) {
        throw new DomainInvariantError("selected region is not available");
      }

      const codeSeed = normalizeCompanyCodeSeed(companyName);
      let companyCode = `PLYR_${codeSeed}`;
      for (let suffix = 2; suffix < 1000; suffix += 1) {
        const conflict = await tx.company.findUnique({
          where: { code: companyCode },
          select: { id: true }
        });
        if (!conflict) {
          break;
        }
        companyCode = `PLYR_${codeSeed}_${suffix}`;
      }

      const company = await tx.company.create({
        data: {
          code: companyCode,
          name: companyName,
          isPlayer: true,
          ownerPlayerId: player.id,
          regionId: chosenRegion.id,
          cashCents: STARTING_CASH_CENTS,
          reservedCashCents: 0n
        },
        select: {
          id: true,
          name: true,
          regionId: true
        }
      });

      const starterItems = await tx.item.findMany({
        where: {
          code: {
            in: STARTER_INVENTORY.map((entry) => entry.code)
          }
        },
        select: {
          id: true,
          code: true
        }
      });
      const itemIdByCode = new Map(starterItems.map((entry) => [entry.code, entry.id] as const));

      const inventoryRows = STARTER_INVENTORY.flatMap((entry) => {
        const itemId = itemIdByCode.get(entry.code);
        if (!itemId) {
          return [];
        }
        return [
          {
            companyId: company.id,
            itemId,
            regionId: chosenRegion.id,
            quantity: entry.quantity,
            reservedQuantity: 0
          }
        ];
      });

      if (inventoryRows.length > 0) {
        await tx.inventory.createMany({
          data: inventoryRows
        });
      }

      const recipeRows = await tx.recipe.findMany({
        select: {
          id: true,
          code: true
        }
      });

      if (recipeRows.length > 0) {
        await tx.companyRecipe.createMany({
          data: recipeRows.map((recipe) => ({
            companyId: company.id,
            recipeId: recipe.id,
            isUnlocked: isDefaultUnlockedRecipe(recipe.code)
          }))
        });
      }

      const basicsNode = await tx.researchNode.findFirst({
        where: { code: "BASICS" },
        select: { id: true }
      });
      if (basicsNode) {
        await tx.companyResearch.upsert({
          where: {
            companyId_nodeId: {
              companyId: company.id,
              nodeId: basicsNode.id
            }
          },
          create: {
            companyId: company.id,
            nodeId: basicsNode.id,
            status: "COMPLETED",
            tickStarted: 0,
            tickCompletes: 0
          },
          update: {
            status: "COMPLETED",
            tickStarted: 0,
            tickCompletes: 0
          }
        });
      }

      return {
        completed: true,
        companyId: company.id,
        companyName: company.name,
        regionId: company.regionId
      };
    });
  }
}


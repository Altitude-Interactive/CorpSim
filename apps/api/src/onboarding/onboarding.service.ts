import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { DomainInvariantError, resolvePlayerById } from "@corpsim/sim";
import type { OnboardingStatus } from "@corpsim/shared";
import { PrismaService } from "../prisma/prisma.service";

interface CompleteOnboardingInput {
  playerId: string;
  displayName?: string;
  username?: string;
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
const MAX_HANDLE_LENGTH = 32;
const FALLBACK_HANDLE = "player";

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

function normalizeHandleSeed(seed: string): string {
  const normalized = seed
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized.length > 0 ? normalized : FALLBACK_HANDLE;
}

function buildHandleCandidate(base: string, suffix: number): string {
  if (suffix === 0) {
    return base.slice(0, MAX_HANDLE_LENGTH);
  }

  const suffixText = `-${suffix + 1}`;
  const baseMaxLength = Math.max(1, MAX_HANDLE_LENGTH - suffixText.length);
  const trimmedBase = base.slice(0, baseMaxLength).replace(/-+$/g, "");
  return `${trimmedBase || FALLBACK_HANDLE}${suffixText}`;
}

function resolveHandleSeed(user: {
  username?: string | null;
  name?: string | null;
  email?: string | null;
}): string {
  if (user.username && user.username.trim().length > 0) {
    return user.username;
  }
  if (user.name && user.name.trim().length > 0) {
    return user.name;
  }
  if (user.email && user.email.trim().length > 0) {
    return user.email.split("@")[0] ?? user.email;
  }
  return FALLBACK_HANDLE;
}

function isPrismaUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function isPrismaRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

function normalizeDisplayName(value?: string): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length < 2) {
    throw new DomainInvariantError("display name must be at least 2 characters");
  }
  if (trimmed.length > 80) {
    throw new DomainInvariantError("display name must be at most 80 characters");
  }
  return trimmed;
}

function normalizeUsername(value?: string): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length < 3) {
    throw new DomainInvariantError("username must be at least 3 characters");
  }
  if (trimmed.length > 32) {
    throw new DomainInvariantError("username must be at most 32 characters");
  }
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(trimmed)) {
    throw new DomainInvariantError("username may only include letters, numbers, dashes, and underscores");
  }
  return trimmed;
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

  private async ensurePlayerRecordForUser(playerId: string): Promise<void> {
    const existing = await this.prisma.player.findUnique({
      where: { id: playerId },
      select: { id: true }
    });
    if (existing) {
      return;
    }

    const authUser = await this.prisma.user.findUnique({
      where: { id: playerId },
      select: {
        id: true,
        username: true,
        name: true,
        email: true
      }
    });

    if (!authUser) {
      return;
    }

    const normalizedBase = normalizeHandleSeed(resolveHandleSeed(authUser));

    for (let suffix = 0; suffix < 10_000; suffix += 1) {
      const handleCandidate = buildHandleCandidate(normalizedBase, suffix);
      try {
        await this.prisma.player.create({
          data: {
            id: authUser.id,
            handle: handleCandidate
          }
        });
        return;
      } catch (error) {
        if (!isPrismaUniqueViolation(error)) {
          throw error;
        }

        const byId = await this.prisma.player.findUnique({
          where: { id: authUser.id },
          select: { id: true }
        });
        if (byId) {
          return;
        }
      }
    }

    throw new DomainInvariantError("failed to allocate a unique player handle");
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

  private async hasCompletedTutorial(playerId: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ tutorialCompletedAt: Date | null }>>`
      SELECT "tutorialCompletedAt"
      FROM "Player"
      WHERE "id" = ${playerId}
      LIMIT 1
    `;
    return Boolean(rows[0]?.tutorialCompletedAt);
  }

  private async applyAccountProfile(
    prisma: PrismaService | Prisma.TransactionClient,
    input: CompleteOnboardingInput
  ): Promise<void> {
    const displayName = normalizeDisplayName(input.displayName);
    const username = normalizeUsername(input.username);

    if (!displayName && !username) {
      return;
    }

    try {
      await prisma.user.update({
        where: { id: input.playerId },
        data: {
          ...(displayName ? { name: displayName } : {}),
          ...(username ? { username, displayUsername: username } : {})
        }
      });
    } catch (error) {
      if (isPrismaUniqueViolation(error)) {
        throw new DomainInvariantError("username is already in use");
      }
      if (isPrismaRecordNotFound(error)) {
        return;
      }
      throw error;
    }
  }

  async getStatus(playerId: string): Promise<OnboardingStatus> {
    await this.ensurePlayerRecordForUser(playerId);
    await resolvePlayerById(this.prisma, playerId);
    const company = await this.getOwnedCompany(playerId);
    const tutorialCompleted = await this.hasCompletedTutorial(playerId);
    return {
      completed: Boolean(company),
      tutorialCompleted,
      companyId: company?.id ?? null,
      companyName: company?.name ?? null,
      regionId: company?.regionId ?? null
    };
  }

  async completeTutorial(playerId: string): Promise<OnboardingStatus> {
    await this.ensurePlayerRecordForUser(playerId);
    await resolvePlayerById(this.prisma, playerId);
    const company = await this.getOwnedCompany(playerId);
    if (!company) {
      throw new DomainInvariantError("complete company setup before finishing tutorial");
    }

    await this.prisma.$executeRaw`
      UPDATE "Player"
      SET "tutorialCompletedAt" = NOW(), "updatedAt" = NOW()
      WHERE "id" = ${playerId}
    `;

    return {
      completed: true,
      tutorialCompleted: true,
      companyId: company.id,
      companyName: company.name,
      regionId: company.regionId
    };
  }

  async complete(input: CompleteOnboardingInput): Promise<OnboardingStatus> {
    await this.ensurePlayerRecordForUser(input.playerId);
    const player = await resolvePlayerById(this.prisma, input.playerId);
    await this.applyAccountProfile(this.prisma, input);
    const companyName = input.companyName.trim();
    if (companyName.length < 2) {
      throw new DomainInvariantError("company name must be at least 2 characters");
    }

    const existingCompany = await this.getOwnedCompany(player.id);
    const tutorialCompleted = await this.hasCompletedTutorial(player.id);
    if (existingCompany) {
      return {
        completed: true,
        tutorialCompleted,
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
        tutorialCompleted: false,
        companyId: company.id,
        companyName: company.name,
        regionId: company.regionId
      };
    });
  }
}

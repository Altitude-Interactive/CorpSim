import { Inject, Injectable } from "@nestjs/common";
import {
  type CompanySummary,
  type PlayerIdentity,
  type PlayerRegistryEntry,
  normalizeCompanySpecialization
} from "@corpsim/shared";
import {
  listCompaniesOwnedByPlayer,
  resolvePlayerById
} from "@corpsim/sim";
import { PrismaService } from "../prisma/prisma.service";

function isAdminRole(role: string | string[] | null | undefined): boolean {
  if (!role) {
    return false;
  }
  const roleValues = Array.isArray(role) ? role : role.split(",");
  return roleValues
    .map((entry) => entry.trim().toLowerCase())
    .some((entry) => entry === "admin");
}

@Injectable()
export class PlayersService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async getCurrentPlayer(playerId: string): Promise<PlayerIdentity> {
    const player = await resolvePlayerById(this.prisma, playerId);
    return {
      id: player.id,
      handle: player.handle,
      createdAt: player.createdAt.toISOString(),
      updatedAt: player.updatedAt.toISOString()
    };
  }

  async listCurrentPlayerCompanies(playerId: string): Promise<CompanySummary[]> {
    const player = await resolvePlayerById(this.prisma, playerId);
    const companies = await listCompaniesOwnedByPlayer(this.prisma, player.id);

    return companies.map((company) => ({
      id: company.id,
      code: company.code,
      name: company.name,
      isBot: !company.isPlayer,
      specialization: normalizeCompanySpecialization(company.specialization),
      cashCents: company.cashCents.toString(),
      regionId: company.region.id,
      regionCode: company.region.code,
      regionName: company.region.name
    }));
  }

  async listPlayerRegistry(requestingPlayerId: string): Promise<PlayerRegistryEntry[]> {
    // Verify the requesting player exists (throws if not found)
    await resolvePlayerById(this.prisma, requestingPlayerId);
    
    const adminUserIds = await this.listAdminUserIds();
    const excludedIds = Array.from(adminUserIds);
    
    // Fetch requesting player with full details (cash + inventory)
    const requestingPlayerData = await this.prisma.player.findUnique({
      where: { id: requestingPlayerId },
      select: {
        id: true,
        handle: true,
        createdAt: true,
        updatedAt: true,
        companies: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            code: true,
            name: true,
            isPlayer: true,
            cashCents: true,
            region: {
              select: {
                id: true,
                code: true,
                name: true
              }
            },
            inventories: {
              where: {
                quantity: {
                  gt: 0
                }
              },
              select: {
                itemId: true,
                quantity: true,
                reservedQuantity: true,
                item: {
                  select: {
                    code: true,
                    name: true
                  }
                }
              }
            }
          }
        }
      }
    });
    
    // Fetch other players without sensitive data (no cash, no inventory)
    const otherPlayers = await this.prisma.player.findMany({
      where: {
        id: { notIn: [...excludedIds, requestingPlayerId] }
      },
      orderBy: { handle: "asc" },
      select: {
        id: true,
        handle: true,
        createdAt: true,
        updatedAt: true,
        companies: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            code: true,
            name: true,
            isPlayer: true,
            region: {
              select: {
                id: true,
                code: true,
                name: true
              }
            }
          }
        }
      }
    });

    // Process requesting player's data with full details
    const processedRequestingPlayer = requestingPlayerData ? [{
      id: requestingPlayerData.id,
      handle: requestingPlayerData.handle,
      createdAt: requestingPlayerData.createdAt.toISOString(),
      updatedAt: requestingPlayerData.updatedAt.toISOString(),
      companies: requestingPlayerData.companies.map((company) => {
        const holdingsByItemId = new Map<
          string,
          {
            itemId: string;
            itemCode: string;
            itemName: string;
            quantity: number;
            reservedQuantity: number;
          }
        >();

        for (const inventoryRow of company.inventories) {
          const existing = holdingsByItemId.get(inventoryRow.itemId);
          if (!existing) {
            holdingsByItemId.set(inventoryRow.itemId, {
              itemId: inventoryRow.itemId,
              itemCode: inventoryRow.item.code,
              itemName: inventoryRow.item.name,
              quantity: inventoryRow.quantity,
              reservedQuantity: inventoryRow.reservedQuantity
            });
            continue;
          }

          existing.quantity += inventoryRow.quantity;
          existing.reservedQuantity += inventoryRow.reservedQuantity;
        }

        const itemHoldings = Array.from(holdingsByItemId.values()).sort((left, right) => {
          if (left.quantity !== right.quantity) {
            return right.quantity - left.quantity;
          }
          return left.itemCode.localeCompare(right.itemCode);
        });

        return {
          id: company.id,
          code: company.code,
          name: company.name,
          isBot: !company.isPlayer,
          cashCents: company.cashCents.toString(),
          regionId: company.region.id,
          regionCode: company.region.code,
          regionName: company.region.name,
          itemHoldings
        };
      })
    }] : [];

    // Process other players' data without sensitive details
    const processedOtherPlayers = otherPlayers.map((player) => ({
      id: player.id,
      handle: player.handle,
      createdAt: player.createdAt.toISOString(),
      updatedAt: player.updatedAt.toISOString(),
      companies: player.companies.map((company) => ({
        id: company.id,
        code: company.code,
        name: company.name,
        isBot: !company.isPlayer,
        cashCents: undefined,
        regionId: company.region.id,
        regionCode: company.region.code,
        regionName: company.region.name,
        itemHoldings: []
      }))
    }));

    // Combine and sort all players by handle
    return [...processedRequestingPlayer, ...processedOtherPlayers].sort((a, b) => 
      a.handle.localeCompare(b.handle)
    );
  }

  private async listAdminUserIds(): Promise<Set<string>> {
    const users = await this.prisma.user.findMany({
      where: {
        role: {
          not: null
        }
      },
      select: {
        id: true,
        role: true
      }
    });

    return new Set(users.filter((user) => isAdminRole(user.role)).map((user) => user.id));
  }
}


import { Inject, Injectable } from "@nestjs/common";
import {
  type CompanySummary,
  type PlayerIdentity,
  type PlayerRegistryEntry,
  normalizeCompanySpecialization
} from "@corpsim/shared";
import {
  listCompaniesOwnedByPlayer,
  resolvePlayerByHandle
} from "@corpsim/sim";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PlayersService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async getCurrentPlayer(playerHandle: string): Promise<PlayerIdentity> {
    const player = await resolvePlayerByHandle(this.prisma, playerHandle);
    return {
      id: player.id,
      handle: player.handle,
      createdAt: player.createdAt.toISOString(),
      updatedAt: player.updatedAt.toISOString()
    };
  }

  async listCurrentPlayerCompanies(playerHandle: string): Promise<CompanySummary[]> {
    const player = await resolvePlayerByHandle(this.prisma, playerHandle);
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

  async listPlayerRegistry(): Promise<PlayerRegistryEntry[]> {
    const players = await this.prisma.player.findMany({
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

    return players.map((player) => ({
      id: player.id,
      handle: player.handle,
      createdAt: player.createdAt.toISOString(),
      updatedAt: player.updatedAt.toISOString(),
      companies: player.companies.map((company) => {
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
    }));
  }
}


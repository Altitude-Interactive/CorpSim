import { Inject, Injectable } from "@nestjs/common";
import type { CompanySummary, PlayerIdentity } from "@corpsim/shared";
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
      cashCents: company.cashCents.toString(),
      regionId: company.region.id,
      regionCode: company.region.code,
      regionName: company.region.name
    }));
  }
}


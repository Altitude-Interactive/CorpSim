import { Inject, Injectable } from "@nestjs/common";
import {
  listCompaniesOwnedByPlayer,
  resolvePlayerByHandle
} from "../../../../packages/sim/src";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PlayersService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async getCurrentPlayer(playerHandle: string) {
    return resolvePlayerByHandle(this.prisma, playerHandle);
  }

  async listCurrentPlayerCompanies(playerHandle: string) {
    const player = await resolvePlayerByHandle(this.prisma, playerHandle);
    const companies = await listCompaniesOwnedByPlayer(this.prisma, player.id);

    return companies.map((company) => ({
      id: company.id,
      code: company.code,
      name: company.name,
      isBot: !company.isPlayer,
      cashCents: company.cashCents.toString()
    }));
  }
}

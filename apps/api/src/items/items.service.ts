import { Inject, Injectable } from "@nestjs/common";
import type { ItemCatalogItem } from "@corpsim/shared";
import {
  assertCompanyOwnedByPlayer,
  listItems,
  resolvePlayerByHandle
} from "@corpsim/sim";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ItemsService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async listItems(companyId: string | undefined, playerHandle: string): Promise<ItemCatalogItem[]> {
    if (companyId) {
      const player = await resolvePlayerByHandle(this.prisma, playerHandle);
      await assertCompanyOwnedByPlayer(this.prisma, player.id, companyId);
    }

    return listItems(this.prisma, { companyId });
  }
}


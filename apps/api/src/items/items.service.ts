import { Inject, Injectable } from "@nestjs/common";
import type { ItemCatalogItem } from "@corpsim/shared";
import { listItems } from "@corpsim/sim";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ItemsService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async listItems(): Promise<ItemCatalogItem[]> {
    return listItems(this.prisma);
  }
}


import { Inject, Injectable } from "@nestjs/common";
import { listItems } from "../../../../packages/sim/src";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ItemsService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async listItems() {
    return listItems(this.prisma);
  }
}

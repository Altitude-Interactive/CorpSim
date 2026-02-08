import { Inject, Injectable } from "@nestjs/common";
import { listRegions } from "../../../../packages/sim/src";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class RegionsService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async listRegions() {
    return listRegions(this.prisma);
  }
}

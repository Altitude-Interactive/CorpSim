import { Inject, Injectable } from "@nestjs/common";
import type { RegionSummary } from "@corpsim/shared";
import { listRegions } from "@corpsim/sim";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class RegionsService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async listRegions(): Promise<RegionSummary[]> {
    return listRegions(this.prisma);
  }
}


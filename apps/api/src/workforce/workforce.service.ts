import { Inject, Injectable } from "@nestjs/common";
import type {
  CompanyWorkforce,
  WorkforceCapacityChangeResult
} from "@corpsim/shared";
import {
  assertCompanyOwnedByPlayer,
  getCompanyWorkforce,
  requestCompanyWorkforceCapacityChange,
  resolvePlayerById,
  setCompanyWorkforceAllocation
} from "@corpsim/sim";
import { PrismaService } from "../prisma/prisma.service";

interface SetAllocationInput {
  companyId: string;
  operationsPct: number;
  researchPct: number;
  logisticsPct: number;
  corporatePct: number;
}

interface CapacityChangeInput {
  companyId: string;
  deltaCapacity: number;
}

@Injectable()
export class WorkforceService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async getCompanyWorkforce(companyId: string, playerId: string): Promise<CompanyWorkforce> {
    const player = await resolvePlayerById(this.prisma, playerId);
    await assertCompanyOwnedByPlayer(this.prisma, player.id, companyId);

    const snapshot = await getCompanyWorkforce(this.prisma, companyId);
    return {
      companyId: snapshot.companyId,
      workforceCapacity: snapshot.workforceCapacity,
      workforceAllocationOpsPct: snapshot.workforceAllocationOpsPct,
      workforceAllocationRngPct: snapshot.workforceAllocationRngPct,
      workforceAllocationLogPct: snapshot.workforceAllocationLogPct,
      workforceAllocationCorpPct: snapshot.workforceAllocationCorpPct,
      orgEfficiencyBps: snapshot.orgEfficiencyBps,
      weeklySalaryBurnCents: snapshot.weeklySalaryBurnCents.toString(),
      projectedModifiers: snapshot.projectedModifiers,
      pendingHiringArrivals: snapshot.pendingHiringArrivals.map((row) => ({
        id: row.id,
        deltaCapacity: row.deltaCapacity,
        tickArrives: row.tickArrives,
        createdAt: row.createdAt.toISOString()
      })),
      updatedAt: snapshot.updatedAt.toISOString()
    };
  }

  async setAllocation(input: SetAllocationInput, playerId: string): Promise<CompanyWorkforce> {
    const player = await resolvePlayerById(this.prisma, playerId);
    await assertCompanyOwnedByPlayer(this.prisma, player.id, input.companyId);

    const snapshot = await setCompanyWorkforceAllocation(this.prisma, input);
    return {
      companyId: snapshot.companyId,
      workforceCapacity: snapshot.workforceCapacity,
      workforceAllocationOpsPct: snapshot.workforceAllocationOpsPct,
      workforceAllocationRngPct: snapshot.workforceAllocationRngPct,
      workforceAllocationLogPct: snapshot.workforceAllocationLogPct,
      workforceAllocationCorpPct: snapshot.workforceAllocationCorpPct,
      orgEfficiencyBps: snapshot.orgEfficiencyBps,
      weeklySalaryBurnCents: snapshot.weeklySalaryBurnCents.toString(),
      projectedModifiers: snapshot.projectedModifiers,
      pendingHiringArrivals: snapshot.pendingHiringArrivals.map((row) => ({
        id: row.id,
        deltaCapacity: row.deltaCapacity,
        tickArrives: row.tickArrives,
        createdAt: row.createdAt.toISOString()
      })),
      updatedAt: snapshot.updatedAt.toISOString()
    };
  }

  async requestCapacityChange(
    input: CapacityChangeInput,
    playerId: string
  ): Promise<WorkforceCapacityChangeResult> {
    const player = await resolvePlayerById(this.prisma, playerId);
    await assertCompanyOwnedByPlayer(this.prisma, player.id, input.companyId);

    const result = await requestCompanyWorkforceCapacityChange(this.prisma, input);
    return {
      companyId: result.companyId,
      deltaCapacity: result.deltaCapacity,
      appliedImmediately: result.appliedImmediately,
      tickRequested: result.tickRequested,
      tickArrives: result.tickArrives,
      recruitmentCostCents: result.recruitmentCostCents.toString(),
      workforceCapacity: result.workforceCapacity,
      orgEfficiencyBps: result.orgEfficiencyBps
    };
  }
}

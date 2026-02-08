import { Inject, Injectable } from "@nestjs/common";
import { LedgerEntryType } from "@prisma/client";
import {
  assertCompanyOwnedByPlayer,
  getCompanyLedger,
  getFinanceSummary,
  resolvePlayerByHandle
} from "../../../../packages/sim/src";
import { PrismaService } from "../prisma/prisma.service";

interface LedgerFilterInput {
  companyId: string;
  fromTick?: number;
  toTick?: number;
  entryType?: LedgerEntryType;
  referenceType?: string;
  referenceId?: string;
  limit?: number;
  cursor?: string;
}

interface FinanceSummaryInput {
  companyId: string;
  windowTicks?: number;
}

@Injectable()
export class FinanceService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async listLedger(filters: LedgerFilterInput, playerHandle: string) {
    const player = await resolvePlayerByHandle(this.prisma, playerHandle);
    await assertCompanyOwnedByPlayer(this.prisma, player.id, filters.companyId);

    const result = await getCompanyLedger(this.prisma, filters);

    return {
      entries: result.entries.map((entry) => ({
        id: entry.id,
        tick: entry.tick,
        entryType: entry.entryType,
        referenceType: entry.referenceType,
        referenceId: entry.referenceId,
        deltaCashCents: entry.deltaCashCents.toString(),
        deltaReservedCashCents: entry.deltaReservedCashCents.toString(),
        balanceAfterCents: entry.balanceAfterCents.toString(),
        createdAt: entry.createdAt
      })),
      nextCursor: result.nextCursor
    };
  }

  async getSummary(input: FinanceSummaryInput, playerHandle: string) {
    const player = await resolvePlayerByHandle(this.prisma, playerHandle);
    await assertCompanyOwnedByPlayer(this.prisma, player.id, input.companyId);

    const summary = await getFinanceSummary(this.prisma, input);

    return {
      startingCashCents: summary.startingCashCents.toString(),
      endingCashCents: summary.endingCashCents.toString(),
      totalDeltaCashCents: summary.totalDeltaCashCents.toString(),
      totalDeltaReservedCashCents: summary.totalDeltaReservedCashCents.toString(),
      breakdownByEntryType: summary.breakdownByEntryType.map((entry) => ({
        entryType: entry.entryType,
        deltaCashCents: entry.deltaCashCents.toString(),
        deltaReservedCashCents: entry.deltaReservedCashCents.toString(),
        count: entry.count
      })),
      tradesCount: summary.tradesCount,
      ordersPlacedCount: summary.ordersPlacedCount,
      ordersCancelledCount: summary.ordersCancelledCount,
      productionsCompletedCount: summary.productionsCompletedCount
    };
  }
}

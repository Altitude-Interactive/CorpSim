import { Inject, Injectable } from "@nestjs/common";
import { LedgerEntryType as PrismaLedgerEntryType } from "@prisma/client";
import type {
  FinanceLedgerEntry,
  FinanceLedgerEntryType,
  FinanceLedgerFilters,
  FinanceLedgerResult,
  FinanceSummary
} from "@corpsim/shared";
import {
  assertCompanyOwnedByPlayer,
  getCompanyLedger,
  getFinanceSummary,
  resolvePlayerByHandle
} from "@corpsim/sim";
import { PrismaService } from "../prisma/prisma.service";

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

  async listLedger(filters: FinanceLedgerFilters, playerHandle: string): Promise<FinanceLedgerResult> {
    const player = await resolvePlayerByHandle(this.prisma, playerHandle);
    await assertCompanyOwnedByPlayer(this.prisma, player.id, filters.companyId);

    const result = await getCompanyLedger(this.prisma, {
      ...filters,
      entryType: filters.entryType as PrismaLedgerEntryType | undefined
    });

    return {
      entries: result.entries.map<FinanceLedgerEntry>((entry) => ({
        id: entry.id,
        tick: entry.tick,
        entryType: entry.entryType as FinanceLedgerEntryType,
        referenceType: entry.referenceType,
        referenceId: entry.referenceId,
        deltaCashCents: entry.deltaCashCents.toString(),
        deltaReservedCashCents: entry.deltaReservedCashCents.toString(),
        balanceAfterCents: entry.balanceAfterCents.toString(),
        createdAt: entry.createdAt.toISOString()
      })),
      nextCursor: result.nextCursor
    };
  }

  async getSummary(input: FinanceSummaryInput, playerHandle: string): Promise<FinanceSummary> {
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


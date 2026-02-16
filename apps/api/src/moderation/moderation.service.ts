import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { LedgerEntryType, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

interface ModerationRefundInput {
  targetUserId: string;
  amountCents: bigint;
  reason: string;
  moderatorId: string;
}

@Injectable()
export class ModerationService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async issueRefund(input: ModerationRefundInput): Promise<{
    ledgerEntryId: string;
    companyId: string;
    balanceAfterCents: bigint;
  }> {
    if (input.amountCents <= 0n) {
      throw new BadRequestException("Refund amount must be positive.");
    }

    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.findFirst({
        where: {
          ownerPlayerId: input.targetUserId,
          isPlayer: true
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          cashCents: true
        }
      });

      if (!company) {
        throw new NotFoundException("Active player company not found.");
      }

      const tick = await this.getCurrentTick(tx);
      const balanceAfterCents = company.cashCents + input.amountCents;

      await tx.company.update({
        where: { id: company.id },
        data: { cashCents: balanceAfterCents }
      });

      const entry = await tx.ledgerEntry.create({
        data: {
          companyId: company.id,
          tick,
          entryType: LedgerEntryType.MANUAL_ADJUSTMENT,
          deltaCashCents: input.amountCents,
          deltaReservedCashCents: 0n,
          balanceAfterCents,
          referenceType: "MODERATION_REFUND",
          referenceId: this.composeReferenceId(input.moderatorId, input.reason)
        }
      });

      return {
        ledgerEntryId: entry.id,
        companyId: company.id,
        balanceAfterCents
      };
    });
  }

  private composeReferenceId(moderatorId: string, reason: string): string {
    const trimmedReason = reason.trim().replace(/\s+/g, " ");
    const suffix = trimmedReason ? `:${trimmedReason}` : "";
    const combined = `${moderatorId}${suffix}`;
    return combined.length > 160 ? combined.slice(0, 160) : combined;
  }

  private async getCurrentTick(tx: Prisma.TransactionClient): Promise<number> {
    const state = await tx.worldTickState.findUnique({
      where: { id: 1 },
      select: { currentTick: true }
    });

    return state?.currentTick ?? 0;
  }
}

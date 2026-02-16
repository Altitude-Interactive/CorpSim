import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
  Body
} from "@nestjs/common";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { MarketService } from "../market/market.service";
import { PrismaService } from "../prisma/prisma.service";
import { ModerationService } from "./moderation.service";

interface RequestWithSession {
  session?: UserSession | null;
}

interface RefundDto {
  targetUserId?: string;
  amountCents?: string | number;
  reason?: string;
}

function hasRole(role: string | string[] | null | undefined, expected: string): boolean {
  if (!role) {
    return false;
  }
  const roleValues = Array.isArray(role) ? role : role.split(",");
  return roleValues
    .map((entry) => entry.trim().toLowerCase())
    .some((entry) => entry === expected);
}

function isStaffRole(role: string | string[] | null | undefined): boolean {
  return hasRole(role, "admin") || hasRole(role, "moderator");
}

@Controller("v1/moderation")
export class ModerationController {
  private readonly moderationService: ModerationService;
  private readonly marketService: MarketService;
  private readonly prisma: PrismaService;

  constructor(
    @Inject(ModerationService) moderationService: ModerationService,
    @Inject(MarketService) marketService: MarketService,
    @Inject(PrismaService) prisma: PrismaService
  ) {
    this.moderationService = moderationService;
    this.marketService = marketService;
    this.prisma = prisma;
  }

  @Post("refunds")
  async issueRefund(@Req() request: RequestWithSession, @Body() body: RefundDto) {
    this.assertStaffSession(request);

    const targetUserId = body.targetUserId?.trim();
    if (!targetUserId) {
      throw new BadRequestException("targetUserId is required");
    }

    await this.assertTargetNotAdmin(targetUserId);

    const reason = body.reason?.trim() ?? "";
    if (!reason) {
      throw new BadRequestException("reason is required");
    }
    if (reason.length > 140) {
      throw new BadRequestException("reason must be 140 characters or less");
    }

    const amountCents = this.parseAmountCents(body.amountCents);
    const moderatorId = request.session!.user.id;

    const result = await this.moderationService.issueRefund({
      targetUserId,
      amountCents,
      reason,
      moderatorId
    });

    return {
      ledgerEntryId: result.ledgerEntryId,
      companyId: result.companyId,
      balanceAfterCents: result.balanceAfterCents.toString()
    };
  }

  @Post("orders/:orderId/cancel")
  async cancelOrder(@Req() request: RequestWithSession, @Param("orderId") orderId: string) {
    this.assertStaffSession(request);

    const trimmedOrderId = orderId?.trim();
    if (!trimmedOrderId) {
      throw new BadRequestException("orderId is required");
    }

    const order = await this.marketService.cancelOrderAsModerator(trimmedOrderId);
    return order;
  }

  private parseAmountCents(value: string | number | undefined): bigint {
    if (typeof value === "number") {
      if (!Number.isInteger(value) || value <= 0) {
        throw new BadRequestException("amountCents must be a positive integer");
      }
      return BigInt(value);
    }

    if (typeof value !== "string") {
      throw new BadRequestException("amountCents is required");
    }

    const trimmed = value.trim();
    if (!/^[0-9]+$/.test(trimmed)) {
      throw new BadRequestException("amountCents must be a positive integer");
    }

    const amount = BigInt(trimmed);
    if (amount <= 0n) {
      throw new BadRequestException("amountCents must be a positive integer");
    }

    return amount;
  }

  private assertStaffSession(request: RequestWithSession): void {
    const session = request.session;
    if (!session?.user) {
      throw new UnauthorizedException("missing authenticated user session");
    }

    if (!isStaffRole(session.user.role)) {
      throw new ForbiddenException("Moderator privileges required");
    }
  }

  private async assertTargetNotAdmin(userId: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<{ role: string | null }[]>`
      SELECT role FROM "user" WHERE id = ${userId} LIMIT 1
    `;

    const role = rows?.[0]?.role ?? null;
    if (rows.length === 0) {
      throw new NotFoundException("User not found.");
    }

    if (hasRole(role, "admin")) {
      throw new ForbiddenException("Admin accounts cannot be modified.");
    }
  }
}

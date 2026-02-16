import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
  Body
} from "@nestjs/common";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { PrismaService } from "../prisma/prisma.service";
import { SupportService } from "./support.service";

interface RequestWithSession {
  session?: UserSession | null;
}

interface UnlinkAccountDto {
  accountId?: string;
}

interface TransferCompanyDto {
  sourceUserId?: string;
  sourceEmail?: string;
  modules?: string[];
}

function isAdminRole(role: string | string[] | null | undefined): boolean {
  if (!role) {
    return false;
  }
  const roleValues = Array.isArray(role) ? role : role.split(",");
  return roleValues
    .map((entry) => entry.trim().toLowerCase())
    .some((entry) => entry === "admin");
}

@Controller("v1/support")
export class SupportController {
  private readonly supportService: SupportService;
  private readonly prisma: PrismaService;

  constructor(
    @Inject(SupportService) supportService: SupportService,
    @Inject(PrismaService) prisma: PrismaService
  ) {
    this.supportService = supportService;
    this.prisma = prisma;
  }

  @Get("users/:userId/accounts")
  async listUserAccounts(@Req() request: RequestWithSession, @Param("userId") userId: string) {
    this.assertAdminSession(request);
    await this.assertTargetNotAdmin(userId);
    const accounts = await this.supportService.listUserAccounts(userId);
    return { accounts };
  }

  @Post("users/:userId/unlink")
  async unlinkAccount(
    @Req() request: RequestWithSession,
    @Param("userId") userId: string,
    @Body() body: UnlinkAccountDto
  ) {
    this.assertAdminSession(request);
    await this.assertTargetNotAdmin(userId);

    const accountId = body.accountId?.trim();
    if (!accountId) {
      throw new BadRequestException("accountId is required");
    }

    await this.supportService.unlinkAccount(userId, accountId);
    return { success: true };
  }

  @Post("users/:userId/transfer")
  async transferCompanyData(
    @Req() request: RequestWithSession,
    @Param("userId") userId: string,
    @Body() body: TransferCompanyDto
  ) {
    this.assertAdminSession(request);
    await this.assertTargetNotAdmin(userId);

    const sourceUserId = body.sourceUserId?.trim();
    const sourceEmail = body.sourceEmail?.trim();

    if (!sourceUserId && !sourceEmail) {
      throw new BadRequestException("sourceUserId or sourceEmail is required");
    }

    const resolvedSourceUserId = sourceUserId || (await this.resolveUserIdByEmail(sourceEmail!));
    if (!resolvedSourceUserId) {
      throw new NotFoundException("Source account not found.");
    }

    if (resolvedSourceUserId === userId) {
      throw new BadRequestException("Source and target accounts must be different.");
    }

    await this.assertTargetNotAdmin(resolvedSourceUserId);

    const modules = Array.isArray(body.modules) ? body.modules : [];
    const result = await this.supportService.transferPlayerCompanyData({
      sourceUserId: resolvedSourceUserId,
      targetUserId: userId,
      modules
    });

    return {
      success: true,
      sourceCompanyId: result.sourceCompanyId,
      targetCompanyId: result.targetCompanyId
    };
  }

  private assertAdminSession(request: RequestWithSession): void {
    const session = request.session;
    if (!session?.user) {
      throw new UnauthorizedException("missing authenticated user session");
    }

    if (!isAdminRole(session.user.role)) {
      throw new ForbiddenException("Admin privileges required");
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

    if (isAdminRole(role)) {
      throw new ForbiddenException("Admin accounts cannot be modified.");
    }
  }

  private async resolveUserIdByEmail(email: string): Promise<string | null> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "user" WHERE lower(email) = lower(${email}) LIMIT 1
    `;

    return rows?.[0]?.id ?? null;
  }
}

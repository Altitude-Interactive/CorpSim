import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface SupportAccountSummary {
  id: string;
  providerId: string;
  accountId: string;
  createdAt: string;
}

@Injectable()
export class SupportService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async listUserAccounts(userId: string): Promise<SupportAccountSummary[]> {
    const accounts = await this.prisma.account.findMany({
      where: { userId },
      select: {
        id: true,
        providerId: true,
        accountId: true,
        createdAt: true
      },
      orderBy: { createdAt: "asc" }
    });

    return accounts.map((account) => ({
      id: account.id,
      providerId: account.providerId,
      accountId: account.accountId,
      createdAt: account.createdAt.toISOString()
    }));
  }

  async unlinkAccount(userId: string, accountId: string): Promise<void> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: { id: true, userId: true, providerId: true }
    });

    if (!account || account.userId !== userId) {
      throw new NotFoundException("Linked account not found.");
    }

    if (account.providerId === "credential") {
      throw new ForbiddenException("Credential accounts cannot be unlinked.");
    }

    await this.prisma.account.delete({ where: { id: accountId } });
  }
}

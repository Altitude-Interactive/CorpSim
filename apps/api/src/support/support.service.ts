import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
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

  async transferPlayerCompanyData(input: {
    sourceUserId: string;
    targetUserId: string;
    modules: string[];
  }): Promise<{ sourceCompanyId: string; targetCompanyId: string }> {
    const modules = this.normalizeModules(input.modules);
    this.assertSupportedModules(modules);

    const sourceCompany = await this.findActivePlayerCompany(input.sourceUserId, true);
    if (!sourceCompany) {
      throw new NotFoundException("Source player company not found.");
    }
    if (modules.has("all")) {
      const targetCompany = await this.findActivePlayerCompany(input.targetUserId, false);
      if (targetCompany && sourceCompany.id === targetCompany.id) {
        throw new ForbiddenException("Source and target accounts are identical.");
      }

      await this.prisma.$transaction(async (tx) => {
        if (targetCompany) {
          await tx.company.update({
            where: { id: targetCompany.id },
            data: {
              ownerPlayerId: null,
              isPlayer: false
            }
          });
        }

        await tx.company.update({
          where: { id: sourceCompany.id },
          data: {
            ownerPlayerId: input.targetUserId,
            isPlayer: true
          }
        });
      });

      return {
        sourceCompanyId: sourceCompany.id,
        targetCompanyId: targetCompany?.id ?? sourceCompany.id
      };
    }

    const targetCompany = await this.findActivePlayerCompany(input.targetUserId, true);
    if (!targetCompany) {
      throw new NotFoundException("Active player company not found.");
    }
    if (sourceCompany.id === targetCompany.id) {
      throw new ForbiddenException("Source and target accounts are identical.");
    }

    await this.prisma.$transaction(async (tx) => {
      if (modules.has("cash")) {
        await tx.company.update({
          where: { id: targetCompany.id },
          data: {
            cashCents: sourceCompany.cashCents,
            reservedCashCents: sourceCompany.reservedCashCents
          }
        });
      }

      if (modules.has("specialization")) {
        await tx.company.update({
          where: { id: targetCompany.id },
          data: {
            specialization: sourceCompany.specialization,
            specializationChangedAt: sourceCompany.specializationChangedAt
          }
        });
      }

      if (modules.has("workforce")) {
        await tx.company.update({
          where: { id: targetCompany.id },
          data: {
            workforceCapacity: sourceCompany.workforceCapacity,
            workforceAllocationOpsPct: sourceCompany.workforceAllocationOpsPct,
            workforceAllocationRngPct: sourceCompany.workforceAllocationRngPct,
            workforceAllocationLogPct: sourceCompany.workforceAllocationLogPct,
            workforceAllocationCorpPct: sourceCompany.workforceAllocationCorpPct,
            orgEfficiencyBps: sourceCompany.orgEfficiencyBps
          }
        });
      }

      if (modules.has("inventory")) {
        await tx.inventory.deleteMany({ where: { companyId: targetCompany.id } });

        const sourceInventory = await tx.inventory.findMany({
          where: { companyId: sourceCompany.id },
          select: {
            itemId: true,
            regionId: true,
            quantity: true,
            reservedQuantity: true
          }
        });

        if (sourceInventory.length > 0) {
          await tx.inventory.createMany({
            data: sourceInventory.map((row) => ({
              companyId: targetCompany.id,
              itemId: row.itemId,
              regionId: row.regionId,
              quantity: row.quantity,
              reservedQuantity: row.reservedQuantity
            }))
          });
        }
      }
    });

    return { sourceCompanyId: sourceCompany.id, targetCompanyId: targetCompany.id };
  }

  private normalizeModules(modules: string[]): Set<string> {
    const normalized = new Set<string>(
      modules.map((entry) => entry.trim().toLowerCase()).filter((entry) => entry.length > 0)
    );

    if (normalized.size === 0) {
      normalized.add("all");
    }

    return normalized;
  }

  private assertSupportedModules(modules: Set<string>): void {
    const allowed = new Set(["all", "cash", "inventory", "specialization", "workforce"]);
    for (const module of modules) {
      if (!allowed.has(module)) {
        throw new BadRequestException(`Unsupported transfer module: ${module}`);
      }
    }
  }

  private async findActivePlayerCompany(playerId: string, require = false) {
    const company = await this.prisma.company.findFirst({
      where: {
        ownerPlayerId: playerId,
        isPlayer: true
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        cashCents: true,
        reservedCashCents: true,
        specialization: true,
        specializationChangedAt: true,
        workforceCapacity: true,
        workforceAllocationOpsPct: true,
        workforceAllocationRngPct: true,
        workforceAllocationLogPct: true,
        workforceAllocationCorpPct: true,
        orgEfficiencyBps: true
      }
    });

    if (!company && require) {
      throw new NotFoundException("Active player company not found.");
    }

    if (!company) {
      return null;
    }

    return company;
  }
}

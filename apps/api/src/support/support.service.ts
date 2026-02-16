import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { CompanySpecialization } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface SupportAccountSummary {
  id: string;
  providerId: string;
  accountId: string;
  createdAt: string;
}

const SUPPORT_EXPORT_SCHEMA_VERSION = 1;
const SUPPORT_EXPORT_KIND = "corpsim-company-export";
const SUPPORT_EXPORT_MODULES = ["cash", "inventory", "specialization", "workforce"] as const;

export type SupportExportModule = (typeof SUPPORT_EXPORT_MODULES)[number];

export interface SupportCompanyExportPayload {
  kind: string;
  schemaVersion: number;
  exportedAt: string;
  exportedTick: number;
  source: {
    userId: string;
    companyId: string;
  };
  modules: SupportExportModule[];
  data: {
    cash?: {
      cashCents: string;
      reservedCashCents: string;
    };
    specialization?: {
      specialization: string;
      specializationChangedAt: string | null;
    };
    workforce?: {
      workforceCapacity: number;
      workforceAllocationOpsPct: number;
      workforceAllocationRngPct: number;
      workforceAllocationLogPct: number;
      workforceAllocationCorpPct: number;
      orgEfficiencyBps: number;
    };
    inventory?: Array<{
      itemId: string;
      regionId: string;
      quantity: number;
      reservedQuantity: number;
    }>;
  };
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

  async exportPlayerCompanyData(userId: string): Promise<SupportCompanyExportPayload> {
    const company = await this.findActivePlayerCompany(userId, true);
    if (!company) {
      throw new NotFoundException("Active player company not found.");
    }

    const inventory = await this.prisma.inventory.findMany({
      where: { companyId: company.id },
      select: {
        itemId: true,
        regionId: true,
        quantity: true,
        reservedQuantity: true
      }
    });

    const currentTick = await this.getCurrentTick();

    return {
      kind: SUPPORT_EXPORT_KIND,
      schemaVersion: SUPPORT_EXPORT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      exportedTick: currentTick,
      source: {
        userId,
        companyId: company.id
      },
      modules: [...SUPPORT_EXPORT_MODULES],
      data: {
        cash: {
          cashCents: company.cashCents.toString(),
          reservedCashCents: company.reservedCashCents.toString()
        },
        specialization: {
          specialization: company.specialization,
          specializationChangedAt: company.specializationChangedAt
            ? company.specializationChangedAt.toISOString()
            : null
        },
        workforce: {
          workforceCapacity: company.workforceCapacity,
          workforceAllocationOpsPct: company.workforceAllocationOpsPct,
          workforceAllocationRngPct: company.workforceAllocationRngPct,
          workforceAllocationLogPct: company.workforceAllocationLogPct,
          workforceAllocationCorpPct: company.workforceAllocationCorpPct,
          orgEfficiencyBps: company.orgEfficiencyBps
        },
        inventory: inventory.map((row) => ({
          itemId: row.itemId,
          regionId: row.regionId,
          quantity: row.quantity,
          reservedQuantity: row.reservedQuantity
        }))
      }
    };
  }

  async importPlayerCompanyData(input: {
    targetUserId: string;
    payload: SupportCompanyExportPayload;
  }): Promise<void> {
    this.assertExportPayload(input.payload);

    const currentTick = await this.getCurrentTick();
    if (input.payload.exportedTick !== currentTick) {
      throw new BadRequestException(
        `Export file is out of date (tick ${input.payload.exportedTick}, current ${currentTick}). Please export again.`
      );
    }

    const targetCompany = await this.findActivePlayerCompany(input.targetUserId, true);
    if (!targetCompany) {
      throw new NotFoundException("Active player company not found.");
    }

    const modules = new Set(input.payload.modules);

    await this.prisma.$transaction(async (tx) => {
      if (modules.has("cash")) {
        const cash = input.payload.data.cash;
        if (!cash) {
          throw new BadRequestException("Export file missing cash data.");
        }
        await tx.company.update({
          where: { id: targetCompany.id },
          data: {
            cashCents: this.parseBigInt(cash.cashCents, "cashCents"),
            reservedCashCents: this.parseBigInt(cash.reservedCashCents, "reservedCashCents")
          }
        });
      }

      if (modules.has("specialization")) {
        const specialization = input.payload.data.specialization;
        if (!specialization) {
          throw new BadRequestException("Export file missing specialization data.");
        }
        const specializationChangedAt = specialization.specializationChangedAt
          ? new Date(specialization.specializationChangedAt)
          : null;
        if (specializationChangedAt && Number.isNaN(specializationChangedAt.valueOf())) {
          throw new BadRequestException("Export file has an invalid specialization timestamp.");
        }
        await tx.company.update({
          where: { id: targetCompany.id },
          data: {
            specialization: this.parseCompanySpecialization(specialization.specialization),
            specializationChangedAt
          }
        });
      }

      if (modules.has("workforce")) {
        const workforce = input.payload.data.workforce;
        if (!workforce) {
          throw new BadRequestException("Export file missing workforce data.");
        }
        await tx.company.update({
          where: { id: targetCompany.id },
          data: {
            workforceCapacity: workforce.workforceCapacity,
            workforceAllocationOpsPct: workforce.workforceAllocationOpsPct,
            workforceAllocationRngPct: workforce.workforceAllocationRngPct,
            workforceAllocationLogPct: workforce.workforceAllocationLogPct,
            workforceAllocationCorpPct: workforce.workforceAllocationCorpPct,
            orgEfficiencyBps: workforce.orgEfficiencyBps
          }
        });
      }

      if (modules.has("inventory")) {
        const inventory = input.payload.data.inventory;
        if (!inventory) {
          throw new BadRequestException("Export file missing inventory data.");
        }

        this.assertInventoryRows(inventory);

        await tx.inventory.deleteMany({ where: { companyId: targetCompany.id } });

        if (inventory.length > 0) {
          await tx.inventory.createMany({
            data: inventory.map((row) => ({
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

  private async getCurrentTick(): Promise<number> {
    const state = await this.prisma.worldTickState.findUnique({
      where: { id: 1 },
      select: { currentTick: true }
    });

    return state?.currentTick ?? 0;
  }

  private assertExportPayload(payload: SupportCompanyExportPayload): void {
    if (!payload || typeof payload !== "object") {
      throw new BadRequestException("Invalid export file payload.");
    }

    if (payload.kind !== SUPPORT_EXPORT_KIND) {
      throw new BadRequestException("Invalid export file type.");
    }

    if (payload.schemaVersion !== SUPPORT_EXPORT_SCHEMA_VERSION) {
      throw new BadRequestException("Unsupported export file version.");
    }

    if (!payload.exportedAt || Number.isNaN(Date.parse(payload.exportedAt))) {
      throw new BadRequestException("Export file has an invalid timestamp.");
    }

    if (!Number.isInteger(payload.exportedTick) || payload.exportedTick < 0) {
      throw new BadRequestException("Export file has an invalid tick value.");
    }

    if (!payload.source?.userId || !payload.source?.companyId) {
      throw new BadRequestException("Export file is missing source identifiers.");
    }

    if (!Array.isArray(payload.modules) || payload.modules.length === 0) {
      throw new BadRequestException("Export file is missing module metadata.");
    }

    for (const module of payload.modules) {
      if (!SUPPORT_EXPORT_MODULES.includes(module)) {
        throw new BadRequestException(`Unsupported export module: ${module}`);
      }
    }

    if (!payload.data || typeof payload.data !== "object") {
      throw new BadRequestException("Export file is missing data payload.");
    }
  }

  private parseBigInt(value: string, field: string): bigint {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new BadRequestException(`Invalid ${field} value in export file.`);
    }

    try {
      return BigInt(value);
    } catch {
      throw new BadRequestException(`Invalid ${field} value in export file.`);
    }
  }

  private assertInventoryRows(
    inventory: Array<{ itemId: string; regionId: string; quantity: number; reservedQuantity: number }>
  ): void {
    for (const row of inventory) {
      if (!row.itemId || !row.regionId) {
        throw new BadRequestException("Export file has invalid inventory identifiers.");
      }
      if (!Number.isInteger(row.quantity) || row.quantity < 0) {
        throw new BadRequestException("Export file has invalid inventory quantity.");
      }
      if (!Number.isInteger(row.reservedQuantity) || row.reservedQuantity < 0) {
        throw new BadRequestException("Export file has invalid reserved inventory quantity.");
      }
    }
  }

  private parseCompanySpecialization(value: string): CompanySpecialization {
    if (!Object.values(CompanySpecialization).includes(value as CompanySpecialization)) {
      throw new BadRequestException("Export file has an invalid specialization value.");
    }

    return value as CompanySpecialization;
  }
}

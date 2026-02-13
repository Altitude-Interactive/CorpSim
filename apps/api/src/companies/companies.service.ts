import { Inject, Injectable } from "@nestjs/common";
import type { CompanyDetails, CompanySummary, InventoryRow } from "@corpsim/shared";
import {
  assertCompanyOwnedByPlayer,
  getCompanyById,
  listCompaniesOwnedByPlayer,
  listCompanies,
  listCompanyInventory,
  resolvePlayerByHandle
} from "@corpsim/sim";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CompaniesService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async listCompanies(): Promise<CompanySummary[]> {
    const companies = await listCompanies(this.prisma);

    return companies.map((company) => ({
      id: company.id,
      code: company.code,
      name: company.name,
      isBot: company.isBot,
      cashCents: company.cashCents.toString(),
      regionId: company.regionId,
      regionCode: company.regionCode,
      regionName: company.regionName
    }));
  }

  async listMyCompanies(playerHandle: string): Promise<CompanySummary[]> {
    const player = await resolvePlayerByHandle(this.prisma, playerHandle);
    const companies = await listCompaniesOwnedByPlayer(this.prisma, player.id);

    return companies.map((company) => ({
      id: company.id,
      code: company.code,
      name: company.name,
      isBot: !company.isPlayer,
      cashCents: company.cashCents.toString(),
      regionId: company.region.id,
      regionCode: company.region.code,
      regionName: company.region.name
    }));
  }

  async getCompany(companyId: string, playerHandle: string): Promise<CompanyDetails> {
    const player = await resolvePlayerByHandle(this.prisma, playerHandle);
    await assertCompanyOwnedByPlayer(this.prisma, player.id, companyId);

    const company = await getCompanyById(this.prisma, companyId);

    return {
      id: company.id,
      code: company.code,
      name: company.name,
      isBot: company.isBot,
      cashCents: company.cashCents.toString(),
      reservedCashCents: company.reservedCashCents.toString(),
      regionId: company.regionId,
      regionCode: company.regionCode,
      regionName: company.regionName,
      createdAt: company.createdAt.toISOString(),
      updatedAt: company.updatedAt.toISOString()
    };
  }

  async getInventory(
    companyId: string,
    playerHandle: string,
    regionId?: string
  ): Promise<InventoryRow[]> {
    const player = await resolvePlayerByHandle(this.prisma, playerHandle);
    await assertCompanyOwnedByPlayer(this.prisma, player.id, companyId);

    const rows = await listCompanyInventory(this.prisma, companyId, regionId);

    return rows.map((row) => ({
      itemId: row.itemId,
      regionId: row.regionId,
      itemCode: row.item.code,
      itemName: row.item.name,
      quantity: row.quantity,
      reservedQuantity: row.reservedQuantity
    }));
  }
}


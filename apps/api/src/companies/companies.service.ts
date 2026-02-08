import { Inject, Injectable } from "@nestjs/common";
import {
  getCompanyById,
  listCompanies,
  listCompanyInventory
} from "../../../../packages/sim/src";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CompaniesService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async listCompanies() {
    const companies = await listCompanies(this.prisma);

    return companies.map((company) => ({
      ...company,
      cashCents: company.cashCents.toString()
    }));
  }

  async getCompany(companyId: string) {
    const company = await getCompanyById(this.prisma, companyId);

    return {
      id: company.id,
      code: company.code,
      name: company.name,
      isBot: company.isBot,
      cashCents: company.cashCents.toString(),
      reservedCashCents: company.reservedCashCents.toString(),
      createdAt: company.createdAt,
      updatedAt: company.updatedAt
    };
  }

  async getInventory(companyId: string) {
    const rows = await listCompanyInventory(this.prisma, companyId);

    return rows.map((row) => ({
      itemId: row.itemId,
      itemCode: row.item.code,
      itemName: row.item.name,
      quantity: row.quantity,
      reservedQuantity: row.reservedQuantity
    }));
  }
}

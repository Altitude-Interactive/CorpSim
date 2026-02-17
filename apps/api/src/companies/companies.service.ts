import { Inject, Injectable } from "@nestjs/common";
import {
  type CompanyDetails,
  type CompanySpecialization,
  type CompanySpecializationOption,
  type CompanySummary,
  type InventoryRow,
  listCompanySpecializationDefinitions,
  normalizeCompanySpecialization
} from "@corpsim/shared";
import {
  assertCompanyOwnedByPlayer,
  getCompanyById,
  listCompaniesOwnedByPlayer,
  listCompanies,
  listCompanyInventory,
  resolvePlayerById,
  setCompanySpecialization
} from "@corpsim/sim";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CompaniesService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async listCompanies(playerId: string): Promise<CompanySummary[]> {
    const companies = await listCompanies(this.prisma);

    return companies.map((company) => {
      const isOwned = company.ownerPlayerId === playerId;
      
      return {
        id: company.id,
        code: company.code,
        name: company.name,
        isBot: company.isBot,
        specialization: normalizeCompanySpecialization(company.specialization),
        // Only show cash for owned companies
        cashCents: isOwned ? company.cashCents.toString() : undefined,
        regionId: company.regionId,
        regionCode: company.regionCode,
        regionName: company.regionName
      };
    });
  }

  async listMyCompanies(playerId: string): Promise<CompanySummary[]> {
    const player = await resolvePlayerById(this.prisma, playerId);
    const companies = await listCompaniesOwnedByPlayer(this.prisma, player.id);

    return companies.map((company) => ({
      id: company.id,
      code: company.code,
      name: company.name,
      isBot: !company.isPlayer,
      specialization: normalizeCompanySpecialization(company.specialization),
      cashCents: company.cashCents.toString(),
      regionId: company.region.id,
      regionCode: company.region.code,
      regionName: company.region.name
    }));
  }

  async getCompany(companyId: string, playerId: string): Promise<CompanyDetails> {
    const player = await resolvePlayerById(this.prisma, playerId);
    await assertCompanyOwnedByPlayer(this.prisma, player.id, companyId);

    const company = await getCompanyById(this.prisma, companyId);

    return {
      id: company.id,
      code: company.code,
      name: company.name,
      isBot: company.isBot,
      specialization: normalizeCompanySpecialization(company.specialization),
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
    playerId: string,
    regionId?: string
  ): Promise<InventoryRow[]> {
    const player = await resolvePlayerById(this.prisma, playerId);
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

  listSpecializationOptions(): CompanySpecializationOption[] {
    return listCompanySpecializationDefinitions().map((entry) => ({
      code: entry.code,
      label: entry.label,
      description: entry.description,
      unlockedCategories: [...entry.unlockedCategories],
      sampleItemCodes: [...entry.sampleItemCodes]
    }));
  }

  async setSpecialization(
    companyId: string,
    specialization: CompanySpecialization,
    playerId: string
  ): Promise<CompanyDetails> {
    const player = await resolvePlayerById(this.prisma, playerId);
    await assertCompanyOwnedByPlayer(this.prisma, player.id, companyId);

    const company = await setCompanySpecialization(this.prisma, {
      companyId,
      specialization
    });

    return {
      id: company.id,
      code: company.code,
      name: company.name,
      isBot: company.isBot,
      specialization: normalizeCompanySpecialization(company.specialization),
      cashCents: company.cashCents.toString(),
      reservedCashCents: company.reservedCashCents.toString(),
      regionId: company.regionId,
      regionCode: company.regionCode,
      regionName: company.regionName,
      createdAt: company.createdAt.toISOString(),
      updatedAt: company.updatedAt.toISOString()
    };
  }
}


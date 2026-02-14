import { Inject, Injectable } from "@nestjs/common";
import { ContractStatus as PrismaContractStatus } from "@prisma/client";
import type {
  ContractFulfillmentResult,
  ContractRecord,
  ContractStatus,
  ListContractsFilters
} from "@corpsim/shared";
import {
  acceptContract,
  assertCompanyOwnedByPlayer,
  fulfillContract,
  listContractsForPlayer,
  resolvePlayerById
} from "@corpsim/sim";
import { PrismaService } from "../prisma/prisma.service";

function mapContractToDto(contract: {
  id: string;
  buyerCompanyId: string;
  sellerCompanyId: string | null;
  itemId: string;
  quantity: number;
  remainingQuantity: number;
  priceCents: bigint;
  status: string;
  tickCreated: number;
  tickExpires: number;
  tickAccepted: number | null;
  tickClosed: number | null;
  createdAt: Date;
  updatedAt: Date;
  item: { id: string; code: string; name: string };
  buyerCompany: { id: string; code: string; name: string };
  sellerCompany: { id: string; code: string; name: string } | null;
}): ContractRecord {
  return {
    id: contract.id,
    buyerCompanyId: contract.buyerCompanyId,
    sellerCompanyId: contract.sellerCompanyId,
    itemId: contract.itemId,
    quantity: contract.quantity,
    remainingQuantity: contract.remainingQuantity,
    priceCents: contract.priceCents.toString(),
    status: contract.status as ContractStatus,
    tickCreated: contract.tickCreated,
    tickExpires: contract.tickExpires,
    tickAccepted: contract.tickAccepted,
    tickClosed: contract.tickClosed,
    createdAt: contract.createdAt.toISOString(),
    updatedAt: contract.updatedAt.toISOString(),
    item: {
      id: contract.item.id,
      code: contract.item.code,
      name: contract.item.name
    },
    buyerCompany: {
      id: contract.buyerCompany.id,
      code: contract.buyerCompany.code,
      name: contract.buyerCompany.name
    },
    sellerCompany: contract.sellerCompany
      ? {
          id: contract.sellerCompany.id,
          code: contract.sellerCompany.code,
          name: contract.sellerCompany.name
        }
      : null
  };
}

@Injectable()
export class ContractsService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async listContracts(input: ListContractsFilters, playerId: string): Promise<ContractRecord[]> {
    const player = await resolvePlayerById(this.prisma, playerId);
    const contracts = await listContractsForPlayer(this.prisma, {
      playerId: player.id,
      status: input.status as PrismaContractStatus | undefined,
      itemId: input.itemId,
      limit: input.limit
    });

    return contracts.map(mapContractToDto);
  }

  async acceptContract(
    contractId: string,
    sellerCompanyId: string,
    playerId: string
  ): Promise<ContractRecord> {
    const player = await resolvePlayerById(this.prisma, playerId);
    await assertCompanyOwnedByPlayer(this.prisma, player.id, sellerCompanyId);

    const contract = await acceptContract(this.prisma, {
      contractId,
      sellerCompanyId
    });

    return mapContractToDto(contract);
  }

  async fulfillContract(
    contractId: string,
    sellerCompanyId: string,
    quantity: number,
    playerId: string
  ): Promise<ContractFulfillmentResult> {
    const player = await resolvePlayerById(this.prisma, playerId);
    await assertCompanyOwnedByPlayer(this.prisma, player.id, sellerCompanyId);

    const result = await fulfillContract(this.prisma, {
      contractId,
      sellerCompanyId,
      quantity
    });

    return {
      contract: mapContractToDto(result.contract),
      fulfillment: {
        id: result.fulfillment.id,
        contractId: result.fulfillment.contractId,
        sellerCompanyId: result.fulfillment.sellerCompanyId,
        itemId: result.fulfillment.itemId,
        quantity: result.fulfillment.quantity,
        priceCents: result.fulfillment.priceCents.toString(),
        tick: result.fulfillment.tick,
        createdAt: result.fulfillment.createdAt.toISOString()
      }
    };
  }
}


import { Inject, Injectable } from "@nestjs/common";
import { ContractStatus } from "@prisma/client";
import {
  acceptContract,
  assertCompanyOwnedByPlayer,
  fulfillContract,
  listContractsForPlayer,
  resolvePlayerByHandle
} from "../../../../packages/sim/src";
import { PrismaService } from "../prisma/prisma.service";

interface ListContractsInput {
  status?: ContractStatus;
  itemId?: string;
  limit?: number;
}

function mapContractToDto(contract: {
  id: string;
  buyerCompanyId: string;
  sellerCompanyId: string | null;
  itemId: string;
  quantity: number;
  remainingQuantity: number;
  priceCents: bigint;
  status: ContractStatus;
  tickCreated: number;
  tickExpires: number;
  tickAccepted: number | null;
  tickClosed: number | null;
  createdAt: Date;
  updatedAt: Date;
  item: { id: string; code: string; name: string };
  buyerCompany: { id: string; code: string; name: string };
  sellerCompany: { id: string; code: string; name: string } | null;
}) {
  return {
    id: contract.id,
    buyerCompanyId: contract.buyerCompanyId,
    sellerCompanyId: contract.sellerCompanyId,
    itemId: contract.itemId,
    quantity: contract.quantity,
    remainingQuantity: contract.remainingQuantity,
    priceCents: contract.priceCents.toString(),
    status: contract.status,
    tickCreated: contract.tickCreated,
    tickExpires: contract.tickExpires,
    tickAccepted: contract.tickAccepted,
    tickClosed: contract.tickClosed,
    createdAt: contract.createdAt,
    updatedAt: contract.updatedAt,
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

  async listContracts(input: ListContractsInput, playerHandle: string) {
    const player = await resolvePlayerByHandle(this.prisma, playerHandle);
    const contracts = await listContractsForPlayer(this.prisma, {
      playerId: player.id,
      status: input.status,
      itemId: input.itemId,
      limit: input.limit
    });

    return contracts.map(mapContractToDto);
  }

  async acceptContract(contractId: string, sellerCompanyId: string, playerHandle: string) {
    const player = await resolvePlayerByHandle(this.prisma, playerHandle);
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
    playerHandle: string
  ) {
    const player = await resolvePlayerByHandle(this.prisma, playerHandle);
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
        createdAt: result.fulfillment.createdAt
      }
    };
  }
}

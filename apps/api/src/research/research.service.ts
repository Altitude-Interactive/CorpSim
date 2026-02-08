import { Inject, Injectable } from "@nestjs/common";
import { ResearchJobStatus } from "@prisma/client";
import {
  assertCompanyOwnedByPlayer,
  cancelResearch,
  DomainInvariantError,
  listCompaniesOwnedByPlayer,
  listResearchForCompany,
  resolvePlayerByHandle,
  startResearch
} from "../../../../packages/sim/src";
import { PrismaService } from "../prisma/prisma.service";

function mapNodeToDto(node: {
  id: string;
  code: string;
  name: string;
  description: string;
  costCashCents: bigint;
  durationTicks: number;
  status: string;
  tickStarted: number | null;
  tickCompletes: number | null;
  prerequisites: Array<{
    nodeId: string;
  }>;
  unlockRecipes: Array<{
    recipeId: string;
    recipeCode: string;
    recipeName: string;
  }>;
}) {
  return {
    id: node.id,
    code: node.code,
    name: node.name,
    description: node.description,
    costCashCents: node.costCashCents.toString(),
    durationTicks: node.durationTicks,
    status: node.status,
    tickStarted: node.tickStarted,
    tickCompletes: node.tickCompletes,
    prerequisites: node.prerequisites,
    unlockRecipes: node.unlockRecipes
  };
}

@Injectable()
export class ResearchService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  private async resolveOwnedCompanyId(playerId: string, companyId?: string): Promise<string> {
    if (companyId) {
      await assertCompanyOwnedByPlayer(this.prisma, playerId, companyId);
      return companyId;
    }

    const companies = await listCompaniesOwnedByPlayer(this.prisma, playerId);
    const first = companies[0];
    if (!first) {
      throw new DomainInvariantError("current player has no owned company");
    }
    return first.id;
  }

  async listResearch(companyId: string | undefined, playerHandle: string) {
    const player = await resolvePlayerByHandle(this.prisma, playerHandle);
    const resolvedCompanyId = await this.resolveOwnedCompanyId(player.id, companyId);
    const nodes = await listResearchForCompany(this.prisma, {
      companyId: resolvedCompanyId
    });

    return {
      companyId: resolvedCompanyId,
      nodes: nodes.map(mapNodeToDto)
    };
  }

  async startNode(nodeId: string, companyId: string | undefined, playerHandle: string) {
    const player = await resolvePlayerByHandle(this.prisma, playerHandle);
    const resolvedCompanyId = await this.resolveOwnedCompanyId(player.id, companyId);

    const job = await startResearch(this.prisma, {
      companyId: resolvedCompanyId,
      nodeId
    });

    return {
      id: job.id,
      companyId: job.companyId,
      nodeId: job.nodeId,
      status: job.status,
      costCashCents: job.costCashCents.toString(),
      tickStarted: job.tickStarted,
      tickCompletes: job.tickCompletes,
      tickClosed: job.tickClosed,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt
    };
  }

  async cancelNode(nodeId: string, companyId: string | undefined, playerHandle: string) {
    const player = await resolvePlayerByHandle(this.prisma, playerHandle);
    const resolvedCompanyId = await this.resolveOwnedCompanyId(player.id, companyId);

    const job = await cancelResearch(this.prisma, {
      companyId: resolvedCompanyId,
      nodeId
    });

    return {
      id: job.id,
      companyId: job.companyId,
      nodeId: job.nodeId,
      status: ResearchJobStatus.CANCELLED,
      costCashCents: job.costCashCents.toString(),
      tickStarted: job.tickStarted,
      tickCompletes: job.tickCompletes,
      tickClosed: job.tickClosed,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt
    };
  }
}

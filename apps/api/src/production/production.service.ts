import { Inject, Injectable } from "@nestjs/common";
import { ProductionJobStatus } from "@prisma/client";
import {
  assertCompanyOwnedByPlayer,
  assertProductionJobOwnedByPlayer,
  cancelProductionJob,
  createProductionJob,
  listProductionJobs,
  listRecipes,
  resolvePlayerByHandle
} from "../../../../packages/sim/src";
import { PrismaService } from "../prisma/prisma.service";
import { ProductionJobStatusFilter } from "./dto/list-production-jobs.dto";

interface ProductionJobFilterInput {
  companyId?: string;
  status?: ProductionJobStatusFilter;
  limit?: number;
}

interface CreateProductionJobInput {
  companyId: string;
  recipeId: string;
  quantity: number;
}

function mapJobStatusToApi(status: ProductionJobStatus): ProductionJobStatusFilter {
  switch (status) {
    case ProductionJobStatus.IN_PROGRESS:
      return ProductionJobStatusFilter.RUNNING;
    case ProductionJobStatus.COMPLETED:
      return ProductionJobStatusFilter.COMPLETED;
    case ProductionJobStatus.CANCELLED:
      return ProductionJobStatusFilter.CANCELLED;
    case ProductionJobStatus.QUEUED:
      return ProductionJobStatusFilter.RUNNING;
    default:
      return ProductionJobStatusFilter.RUNNING;
  }
}

function mapApiStatusToJobStatus(status?: ProductionJobStatusFilter): ProductionJobStatus | undefined {
  switch (status) {
    case ProductionJobStatusFilter.RUNNING:
      return ProductionJobStatus.IN_PROGRESS;
    case ProductionJobStatusFilter.COMPLETED:
      return ProductionJobStatus.COMPLETED;
    case ProductionJobStatusFilter.CANCELLED:
      return ProductionJobStatus.CANCELLED;
    default:
      return undefined;
  }
}

function mapJobToDto(job: {
  id: string;
  companyId: string;
  recipeId: string;
  status: ProductionJobStatus;
  runs: number;
  startedTick: number;
  dueTick: number;
  completedTick: number | null;
  createdAt: Date;
  updatedAt: Date;
  recipe: {
    id: string;
    code: string;
    name: string;
    durationTicks: number;
    outputQuantity: number;
    outputItem: {
      id: string;
      code: string;
      name: string;
    };
    inputs: Array<{
      itemId: string;
      quantity: number;
      item: {
        id: string;
        code: string;
        name: string;
      };
    }>;
  };
}) {
  return {
    id: job.id,
    companyId: job.companyId,
    recipeId: job.recipeId,
    status: mapJobStatusToApi(job.status),
    quantity: job.runs,
    tickStarted: job.startedTick,
    tickCompletionExpected: job.dueTick,
    tickCompleted: job.completedTick,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    recipe: {
      id: job.recipe.id,
      code: job.recipe.code,
      name: job.recipe.name,
      durationTicks: job.recipe.durationTicks,
      outputQuantity: job.recipe.outputQuantity,
      outputItem: {
        id: job.recipe.outputItem.id,
        code: job.recipe.outputItem.code,
        name: job.recipe.outputItem.name
      },
      inputs: job.recipe.inputs.map((input) => ({
        itemId: input.itemId,
        quantityPerRun: input.quantity,
        quantityTotal: input.quantity * job.runs,
        item: {
          id: input.item.id,
          code: input.item.code,
          name: input.item.name
        }
      }))
    }
  };
}

@Injectable()
export class ProductionService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async listRecipes() {
    const recipes = await listRecipes(this.prisma);

    return recipes.map((recipe) => ({
      id: recipe.id,
      code: recipe.code,
      name: recipe.name,
      durationTicks: recipe.durationTicks,
      outputQuantity: recipe.outputQuantity,
      outputItem: {
        id: recipe.outputItem.id,
        code: recipe.outputItem.code,
        name: recipe.outputItem.name
      },
      inputs: recipe.inputs.map((input) => ({
        itemId: input.itemId,
        quantityPerRun: input.quantity,
        item: {
          id: input.item.id,
          code: input.item.code,
          name: input.item.name
        }
      }))
    }));
  }

  async listJobs(filters: ProductionJobFilterInput, playerHandle: string) {
    const player = await resolvePlayerByHandle(this.prisma, playerHandle);

    if (filters.companyId) {
      await assertCompanyOwnedByPlayer(this.prisma, player.id, filters.companyId);
    }

    const jobs = await listProductionJobs(this.prisma, {
      companyId: filters.companyId,
      status: mapApiStatusToJobStatus(filters.status),
      limit: filters.limit
    });

    return jobs.map(mapJobToDto);
  }

  async createJob(input: CreateProductionJobInput, playerHandle: string) {
    const player = await resolvePlayerByHandle(this.prisma, playerHandle);
    await assertCompanyOwnedByPlayer(this.prisma, player.id, input.companyId);

    const job = await createProductionJob(this.prisma, {
      companyId: input.companyId,
      recipeId: input.recipeId,
      quantity: input.quantity
    });

    return mapJobToDto(job);
  }

  async cancelJob(jobId: string, playerHandle: string) {
    const player = await resolvePlayerByHandle(this.prisma, playerHandle);
    await assertProductionJobOwnedByPlayer(this.prisma, player.id, jobId);

    const job = await cancelProductionJob(this.prisma, { jobId });
    return mapJobToDto(job);
  }
}

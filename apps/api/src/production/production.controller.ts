import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query
} from "@nestjs/common";
import { CancelProductionJobParamDto } from "./dto/cancel-production-job.dto";
import { CreateProductionJobDto } from "./dto/create-production-job.dto";
import { ListProductionJobsDto } from "./dto/list-production-jobs.dto";
import { ProductionService } from "./production.service";

function parseLimit(value?: string): number {
  if (value === undefined) {
    return 100;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 500) {
    throw new BadRequestException("limit must be an integer between 1 and 500");
  }

  return parsed;
}

@Controller("v1/production")
export class ProductionController {
  private readonly productionService: ProductionService;

  constructor(@Inject(ProductionService) productionService: ProductionService) {
    this.productionService = productionService;
  }

  @Get("recipes")
  async listRecipes() {
    return this.productionService.listRecipes();
  }

  @Get("jobs")
  async listJobs(@Query() query: ListProductionJobsDto) {
    return this.productionService.listJobs({
      companyId: query.companyId,
      status: query.status,
      limit: parseLimit(query.limit)
    });
  }

  @Post("jobs")
  async createJob(@Body() body: CreateProductionJobDto) {
    return this.productionService.createJob({
      companyId: body.companyId,
      recipeId: body.recipeId,
      quantity: body.quantity
    });
  }

  @Post("jobs/:id/cancel")
  @HttpCode(HttpStatus.OK)
  async cancelJob(@Param() params: CancelProductionJobParamDto) {
    return this.productionService.cancelJob(params.id);
  }
}

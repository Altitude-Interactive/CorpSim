import { IsEnum, IsOptional, IsString, MinLength } from "class-validator";

export enum ProductionJobStatusFilter {
  RUNNING = "RUNNING",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED"
}

export class ListProductionJobsDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  companyId?: string;

  @IsOptional()
  @IsEnum(ProductionJobStatusFilter)
  status?: ProductionJobStatusFilter;

  @IsOptional()
  @IsString()
  @MinLength(1)
  limit?: string;
}

import { IsOptional, IsString, MinLength } from "class-validator";

export class GetFinanceSummaryDto {
  @IsString()
  @MinLength(1)
  companyId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  windowTicks?: string;
}

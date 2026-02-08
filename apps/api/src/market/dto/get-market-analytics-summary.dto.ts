import { IsNumberString, IsOptional, IsString, MinLength } from "class-validator";

export class GetMarketAnalyticsSummaryDto {
  @IsString()
  @MinLength(1)
  itemId!: string;

  @IsString()
  @MinLength(1)
  regionId!: string;

  @IsOptional()
  @IsNumberString({ no_symbols: true })
  windowTicks?: string;
}

import { IsNumberString, IsOptional, IsString, MinLength } from "class-validator";

export class ListMarketCandlesDto {
  @IsString()
  @MinLength(1)
  itemId!: string;

  @IsString()
  @MinLength(1)
  regionId!: string;

  @IsOptional()
  @IsNumberString({ no_symbols: true })
  fromTick?: string;

  @IsOptional()
  @IsNumberString({ no_symbols: true })
  toTick?: string;

  @IsOptional()
  @IsNumberString({ no_symbols: true })
  limit?: string;
}

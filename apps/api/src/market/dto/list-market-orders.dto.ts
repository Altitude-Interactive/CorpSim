import { OrderSide } from "@prisma/client";
import { IsEnum, IsNumberString, IsOptional, IsString, MinLength } from "class-validator";

export class ListMarketOrdersDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  itemId?: string;

  @IsOptional()
  @IsEnum(OrderSide)
  side?: OrderSide;

  @IsOptional()
  @IsString()
  @MinLength(1)
  companyId?: string;

  @IsOptional()
  @IsNumberString({ no_symbols: true })
  limit?: string;
}

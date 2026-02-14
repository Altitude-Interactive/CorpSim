import { OrderSide, OrderStatus } from "@prisma/client";
import { IsEnum, IsNumberString, IsOptional, IsString, MinLength } from "class-validator";

export class ListMarketOrdersDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  itemId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  regionId?: string;

  @IsOptional()
  @IsEnum(OrderSide)
  side?: OrderSide;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsString()
  @MinLength(1)
  companyId?: string;

  @IsOptional()
  @IsNumberString({ no_symbols: true })
  limit?: string;
}

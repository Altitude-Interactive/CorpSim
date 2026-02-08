import { OrderSide } from "@prisma/client";
import { IsEnum, IsOptional, IsString, MinLength } from "class-validator";

export class ListMarketOrdersDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  itemId?: string;

  @IsOptional()
  @IsEnum(OrderSide)
  side?: OrderSide;
}

import { OrderSide } from "@prisma/client";
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateMarketOrderDto {
  @IsString()
  @MinLength(1)
  companyId!: string;

  @IsString()
  @MinLength(1)
  itemId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  regionId?: string;

  @IsEnum(OrderSide)
  side!: OrderSide;

  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 0 })
  @IsInt()
  @Min(1)
  priceCents!: number;

  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 0 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

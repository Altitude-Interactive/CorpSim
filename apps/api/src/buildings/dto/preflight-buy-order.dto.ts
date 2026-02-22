import { IsInt, IsNumber, IsString, Min, MinLength } from "class-validator";

export class PreflightBuyOrderDto {
  @IsString()
  @MinLength(1)
  companyId!: string;

  @IsString()
  @MinLength(1)
  regionId!: string;

  @IsString()
  @MinLength(1)
  itemId!: string;

  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 0 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

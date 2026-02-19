import { IsInt, IsNumber, IsString, Min, MinLength } from "class-validator";

export class PreflightProductionJobDto {
  @IsString()
  @MinLength(1)
  companyId!: string;

  @IsString()
  @MinLength(1)
  recipeId!: string;

  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 0 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

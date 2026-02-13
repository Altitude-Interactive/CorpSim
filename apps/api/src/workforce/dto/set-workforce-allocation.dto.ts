import { IsInt, IsNumber, IsString, Max, Min, MinLength } from "class-validator";

export class SetWorkforceAllocationDto {
  @IsString()
  @MinLength(1)
  companyId!: string;

  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 0 })
  @IsInt()
  @Min(0)
  @Max(100)
  operationsPct!: number;

  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 0 })
  @IsInt()
  @Min(0)
  @Max(100)
  researchPct!: number;

  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 0 })
  @IsInt()
  @Min(0)
  @Max(100)
  logisticsPct!: number;

  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 0 })
  @IsInt()
  @Min(0)
  @Max(100)
  corporatePct!: number;
}

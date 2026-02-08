import { IsInt, IsNumber, IsOptional, Min } from "class-validator";

export class AdvanceWorldDto {
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 0 })
  @IsInt()
  @Min(1)
  ticks!: number;

  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 0 })
  @IsInt()
  @Min(0)
  expectedLockVersion?: number;
}

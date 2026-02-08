import { IsInt, IsNumber, Min } from "class-validator";

export class AdvanceWorldDto {
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 0 })
  @IsInt()
  @Min(1)
  ticks!: number;
}

import { IsInt, IsNumber, IsString, MinLength, NotEquals } from "class-validator";

export class RequestWorkforceCapacityChangeDto {
  @IsString()
  @MinLength(1)
  companyId!: string;

  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 0 })
  @IsInt()
  @NotEquals(0)
  deltaCapacity!: number;
}

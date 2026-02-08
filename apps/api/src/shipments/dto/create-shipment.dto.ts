import { IsInt, IsString, Min, MinLength } from "class-validator";

export class CreateShipmentDto {
  @IsString()
  @MinLength(1)
  companyId!: string;

  @IsString()
  @MinLength(1)
  toRegionId!: string;

  @IsString()
  @MinLength(1)
  itemId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

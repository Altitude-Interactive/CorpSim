import { IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { BuildingType } from "@prisma/client";

export class AcquireBuildingDto {
  @IsString()
  @MinLength(1)
  companyId!: string;

  @IsString()
  @MinLength(1)
  regionId!: string;

  @IsEnum(BuildingType)
  buildingType!: BuildingType;

  @IsOptional()
  @IsString()
  name?: string;
}

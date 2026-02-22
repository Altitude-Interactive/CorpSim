import { IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { BuildingStatus } from "@prisma/client";

export class ListBuildingsDto {
  @IsString()
  @MinLength(1)
  companyId!: string;

  @IsOptional()
  @IsString()
  regionId?: string;

  @IsOptional()
  @IsEnum(BuildingStatus)
  status?: BuildingStatus;
}

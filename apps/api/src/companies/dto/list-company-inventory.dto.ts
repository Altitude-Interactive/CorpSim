import { IsOptional, IsString, MinLength } from "class-validator";

export class ListCompanyInventoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  regionId?: string;
}

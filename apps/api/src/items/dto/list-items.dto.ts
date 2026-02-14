import { IsOptional, IsString, MinLength } from "class-validator";

export class ListItemsDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  companyId?: string;
}

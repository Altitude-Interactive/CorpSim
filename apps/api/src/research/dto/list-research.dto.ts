import { IsOptional, IsString, MinLength } from "class-validator";

export class ListResearchDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  companyId?: string;
}

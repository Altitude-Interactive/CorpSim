import { IsOptional, IsString, MinLength } from "class-validator";

export class MutateResearchDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  companyId?: string;
}

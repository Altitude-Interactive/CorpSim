import { IsString, MinLength } from "class-validator";

export class GetCompanyWorkforceDto {
  @IsString()
  @MinLength(1)
  companyId!: string;
}

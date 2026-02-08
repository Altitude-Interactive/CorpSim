import { IsString, MinLength } from "class-validator";

export class CompanyParamDto {
  @IsString()
  @MinLength(1)
  id!: string;
}

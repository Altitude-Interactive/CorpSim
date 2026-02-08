import { IsString, MinLength } from "class-validator";

export class ContractParamDto {
  @IsString()
  @MinLength(1)
  id!: string;
}

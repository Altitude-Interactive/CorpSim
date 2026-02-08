import { ContractStatus } from "@prisma/client";
import { IsEnum, IsOptional, IsString, MinLength } from "class-validator";

export class ListContractsDto {
  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;

  @IsOptional()
  @IsString()
  @MinLength(1)
  itemId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  limit?: string;
}

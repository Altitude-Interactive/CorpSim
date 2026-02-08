import { LedgerEntryType } from "@prisma/client";
import { IsEnum, IsOptional, IsString, MinLength } from "class-validator";

export class ListLedgerDto {
  @IsString()
  @MinLength(1)
  companyId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  fromTick?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  toTick?: string;

  @IsOptional()
  @IsEnum(LedgerEntryType)
  entryType?: LedgerEntryType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  referenceType?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  referenceId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  limit?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  cursor?: string;
}

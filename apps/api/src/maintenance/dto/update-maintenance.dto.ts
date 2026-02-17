import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from "class-validator";
import { MAINTENANCE_SCOPES } from "../maintenance.types";
import type { MaintenanceScope } from "../maintenance.types";

export class UpdateMaintenanceDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  reason?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  enabledBy?: string;

  @IsOptional()
  @IsIn(MAINTENANCE_SCOPES)
  scope?: MaintenanceScope;

  @IsOptional()
  @IsISO8601({ strict: true })
  eta?: string | null;
}

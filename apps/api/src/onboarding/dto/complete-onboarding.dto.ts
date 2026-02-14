import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CompleteOnboardingDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  username?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(64)
  companyName!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  regionId?: string;
}

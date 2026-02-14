import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CompleteOnboardingDto {
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


import { IsBoolean, IsIn, IsOptional } from "class-validator";

export class ResetWorldBodyDto {
  @IsOptional()
  @IsBoolean()
  reseed?: boolean;
}

export class ResetWorldQueryDto {
  @IsOptional()
  @IsIn(["true", "false"])
  reseed?: string;
}

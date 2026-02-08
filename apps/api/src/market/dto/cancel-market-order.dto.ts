import { IsString, MinLength } from "class-validator";

export class CancelMarketOrderParamDto {
  @IsString()
  @MinLength(1)
  id!: string;
}

import { IsString, MinLength } from "class-validator";

export class CancelShipmentParamDto {
  @IsString()
  @MinLength(1)
  id!: string;
}

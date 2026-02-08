import { IsString, MinLength } from "class-validator";

export class CancelProductionJobParamDto {
  @IsString()
  @MinLength(1)
  id!: string;
}

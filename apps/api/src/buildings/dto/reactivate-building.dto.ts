import { IsString, MinLength } from "class-validator";

export class ReactivateBuildingDto {
  @IsString()
  @MinLength(1)
  buildingId!: string;
}

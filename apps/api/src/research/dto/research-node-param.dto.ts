import { IsString, MinLength } from "class-validator";

export class ResearchNodeParamDto {
  @IsString()
  @MinLength(1)
  nodeId!: string;
}

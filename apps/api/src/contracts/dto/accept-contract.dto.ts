import { IsString, MinLength } from "class-validator";

export class AcceptContractDto {
  @IsString()
  @MinLength(1)
  sellerCompanyId!: string;
}

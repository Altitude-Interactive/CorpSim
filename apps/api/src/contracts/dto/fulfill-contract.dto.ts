import { IsInt, IsString, Min, MinLength } from "class-validator";

export class FulfillContractDto {
  @IsString()
  @MinLength(1)
  sellerCompanyId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

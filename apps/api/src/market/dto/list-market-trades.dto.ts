import { IsOptional, IsString } from "class-validator";

export class ListMarketTradesDto {
  @IsOptional()
  @IsString()
  itemId?: string;

  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}

import { COMPANY_SPECIALIZATION_CODES, type CompanySpecialization } from "@corpsim/shared";
import { IsIn } from "class-validator";

export class SetCompanySpecializationDto {
  @IsIn(COMPANY_SPECIALIZATION_CODES)
  specialization!: CompanySpecialization;
}

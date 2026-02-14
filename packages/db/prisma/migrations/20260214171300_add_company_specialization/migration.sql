-- CreateEnum
CREATE TYPE "CompanySpecialization" AS ENUM ('UNASSIGNED', 'INDUSTRIAL', 'BIOTECH', 'CONSUMER', 'DEFENSE');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "specialization" "CompanySpecialization" NOT NULL DEFAULT 'UNASSIGNED';

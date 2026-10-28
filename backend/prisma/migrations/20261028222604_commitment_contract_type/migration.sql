-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('PERMANENT', 'FIXED_TERM', 'INTERNSHIP');

-- AlterTable
ALTER TABLE "Commitment" ADD COLUMN     "contractType" "ContractType",
ADD COLUMN     "endsOn" TIMESTAMP(3);

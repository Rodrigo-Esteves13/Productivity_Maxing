-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DrugClass" ADD VALUE 'MODAFINIL';
ALTER TYPE "DrugClass" ADD VALUE 'ST_JOHNS_WORT';
ALTER TYPE "DrugClass" ADD VALUE 'HORMONAL_CONTRACEPTIVE';
ALTER TYPE "DrugClass" ADD VALUE 'ENZYME_INDUCER';
ALTER TYPE "DrugClass" ADD VALUE 'ANTICOAGULANT';
ALTER TYPE "DrugClass" ADD VALUE 'METRONIDAZOLE';
ALTER TYPE "DrugClass" ADD VALUE 'DEXTROMETHORPHAN';
ALTER TYPE "DrugClass" ADD VALUE 'SULFONYLUREA';
ALTER TYPE "DrugClass" ADD VALUE 'ANTIHYPERTENSIVE';
ALTER TYPE "DrugClass" ADD VALUE 'NITRATE';
ALTER TYPE "DrugClass" ADD VALUE 'PDE5_INHIBITOR';
ALTER TYPE "DrugClass" ADD VALUE 'STATIN';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "medicationDisclaimerAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "medicationDisclaimerVersion" INTEGER;

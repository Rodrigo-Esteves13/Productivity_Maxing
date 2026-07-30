-- AlterTable
ALTER TABLE "AcademicPeriod" ADD COLUMN     "roundFinalGrade" BOOLEAN;

-- AlterTable
ALTER TABLE "AcademicProgram" ADD COLUMN     "roundFinalGrade" BOOLEAN NOT NULL DEFAULT true;

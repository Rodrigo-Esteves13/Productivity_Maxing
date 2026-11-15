-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN     "generators" TEXT[] DEFAULT ARRAY[]::TEXT[];

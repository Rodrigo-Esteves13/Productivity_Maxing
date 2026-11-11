-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mutedPushKinds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateEnum
CREATE TYPE "CommuteMode" AS ENUM ('DRIVING', 'WALKING', 'BICYCLING', 'TRANSIT');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "commuteMode" "CommuteMode" NOT NULL DEFAULT 'TRANSIT';

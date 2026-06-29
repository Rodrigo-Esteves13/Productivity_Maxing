/*
  Warnings:

  - You are about to drop the column `status` on the `Task` table. All the data in the column will be lost.
  - Added the required column `colorHex` to the `Subject` table without a default value. This is not possible if the table is not empty.
  - Added the required column `date` to the `Task` table without a default value. This is not possible if the table is not empty.
  - Added the required column `difficulty` to the `Task` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subjectId` to the `Task` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Task` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('GOOGLE', 'DISCORD', 'GITHUB');

-- CreateEnum
CREATE TYPE "ProgressStatus" AS ENUM ('ADIANTADO', 'TEMPO_ESPERADO', 'ATRASADO', 'MUITO_ATRASADO');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('FACIL', 'MEDIO', 'DIFICIL', 'MUITO_DIFICIL');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('FREQUENCIA', 'TRABALHO_PRATICO', 'TAREFA_SECUNDARIA');

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "colorHex" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "status",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "date" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "difficulty" "Difficulty" NOT NULL,
ADD COLUMN     "googleCalendarEventId" TEXT,
ADD COLUMN     "progressStatus" "ProgressStatus" NOT NULL DEFAULT 'TEMPO_ESPERADO',
ADD COLUMN     "realGrade" DOUBLE PRECISION,
ADD COLUMN     "referenceLink" TEXT,
ADD COLUMN     "subjectId" TEXT NOT NULL,
ADD COLUMN     "targetGrade" DOUBLE PRECISION,
ADD COLUMN     "topics" TEXT,
ADD COLUMN     "type" "TaskType" NOT NULL,
ADD COLUMN     "weightPercentage" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "passwordHash" TEXT;

-- CreateTable
CREATE TABLE "Identity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "scope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Identity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Identity_provider_providerAccountId_key" ON "Identity"("provider", "providerAccountId");

-- AddForeignKey
ALTER TABLE "Identity" ADD CONSTRAINT "Identity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

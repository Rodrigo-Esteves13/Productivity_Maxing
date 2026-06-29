/*
  Warnings:

  - The values [FREQUENCIA,TRABALHO_PRATICO,TAREFA_SECUNDARIA] on the enum `TaskType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `subjectId` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the `Subject` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `areaId` to the `Task` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AcademicTaskType" AS ENUM ('FREQUENCIA', 'TRABALHO_PRATICO', 'TAREFA_SECUNDARIA');

-- AlterEnum
BEGIN;
CREATE TYPE "TaskType_new" AS ENUM ('ACADEMICO', 'HABITO', 'PROJETO', 'EVENTO', 'TRABALHO', 'TAREFA_SIMPLES');
ALTER TABLE "Task" ALTER COLUMN "type" TYPE "TaskType_new" USING ("type"::text::"TaskType_new");
ALTER TYPE "TaskType" RENAME TO "TaskType_old";
ALTER TYPE "TaskType_new" RENAME TO "TaskType";
DROP TYPE "public"."TaskType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Subject" DROP CONSTRAINT "Subject_userId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_subjectId_fkey";

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "subjectId",
ADD COLUMN     "academicType" "AcademicTaskType",
ADD COLUMN     "areaId" TEXT NOT NULL;

-- DropTable
DROP TABLE "Subject";

-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "colorHex" TEXT NOT NULL,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Area" ADD CONSTRAINT "Area_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

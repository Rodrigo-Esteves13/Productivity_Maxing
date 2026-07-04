/*
  Warnings:

  - You are about to drop the column `academicType` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Task` table. All the data in the column will be lost.
  - Added the required column `taskTypeId` to the `Task` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Task" DROP COLUMN "academicType",
DROP COLUMN "type",
ADD COLUMN     "academicTypeId" TEXT,
ADD COLUMN     "taskTypeId" TEXT NOT NULL;

-- DropEnum
DROP TYPE "AcademicTaskType";

-- DropEnum
DROP TYPE "TaskType";

-- CreateTable
CREATE TABLE "TaskType" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "colorHex" TEXT DEFAULT '#808080',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TaskType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicTaskType" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "taskTypeId" TEXT NOT NULL,

    CONSTRAINT "AcademicTaskType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskType_key_key" ON "TaskType"("key");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicTaskType_key_key" ON "AcademicTaskType"("key");

-- AddForeignKey
ALTER TABLE "AcademicTaskType" ADD CONSTRAINT "AcademicTaskType_taskTypeId_fkey" FOREIGN KEY ("taskTypeId") REFERENCES "TaskType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_taskTypeId_fkey" FOREIGN KEY ("taskTypeId") REFERENCES "TaskType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_academicTypeId_fkey" FOREIGN KEY ("academicTypeId") REFERENCES "AcademicTaskType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

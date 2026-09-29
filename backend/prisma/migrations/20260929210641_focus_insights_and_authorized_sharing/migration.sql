/*
  Warnings:

  - Added the required column `updatedAt` to the `Task` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "NotebookShareVisibility" AS ENUM ('PUBLIC', 'AUTHORIZED');

-- CreateEnum
CREATE TYPE "ShareAccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- AlterTable
ALTER TABLE "NotebookShare" ADD COLUMN     "visibility" "NotebookShareVisibility" NOT NULL DEFAULT 'PUBLIC';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "updatedAt" TIMESTAMP(3);
UPDATE "Task" SET "updatedAt" = "createdAt";
ALTER TABLE "Task" ALTER COLUMN "updatedAt" SET NOT NULL;

-- CreateTable
CREATE TABLE "NotebookShareAccessRequest" (
    "id" TEXT NOT NULL,
    "notebookShareId" TEXT NOT NULL,
    "requestingUserId" TEXT NOT NULL,
    "status" "ShareAccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "NotebookShareAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotebookShareAccessRequest_notebookShareId_status_idx" ON "NotebookShareAccessRequest"("notebookShareId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "NotebookShareAccessRequest_notebookShareId_requestingUserId_key" ON "NotebookShareAccessRequest"("notebookShareId", "requestingUserId");

-- AddForeignKey
ALTER TABLE "NotebookShareAccessRequest" ADD CONSTRAINT "NotebookShareAccessRequest_notebookShareId_fkey" FOREIGN KEY ("notebookShareId") REFERENCES "NotebookShare"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotebookShareAccessRequest" ADD CONSTRAINT "NotebookShareAccessRequest_requestingUserId_fkey" FOREIGN KEY ("requestingUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

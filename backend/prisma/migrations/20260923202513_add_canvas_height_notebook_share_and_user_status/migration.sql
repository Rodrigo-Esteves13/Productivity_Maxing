-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED');

-- AlterTable
ALTER TABLE "NotebookEntry" ADD COLUMN     "canvasHeight" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "statusReason" TEXT,
ADD COLUMN     "statusUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "statusUpdatedByUserId" TEXT,
ADD COLUMN     "suspendedUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "NotebookShare" (
    "id" TEXT NOT NULL,
    "notebookEntryId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotebookShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotebookShare_notebookEntryId_key" ON "NotebookShare"("notebookEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "NotebookShare_token_key" ON "NotebookShare"("token");

-- CreateIndex
CREATE INDEX "NotebookShare_token_idx" ON "NotebookShare"("token");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_statusUpdatedByUserId_fkey" FOREIGN KEY ("statusUpdatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotebookShare" ADD CONSTRAINT "NotebookShare_notebookEntryId_fkey" FOREIGN KEY ("notebookEntryId") REFERENCES "NotebookEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotebookShare" ADD CONSTRAINT "NotebookShare_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

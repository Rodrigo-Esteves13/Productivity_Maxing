-- AlterTable
ALTER TABLE "NotebookEntry" ADD COLUMN     "usefulLinks" JSONB;

-- CreateTable
CREATE TABLE "NotebookAttachment" (
    "id" TEXT NOT NULL,
    "notebookEntryId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotebookAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotebookAttachment_notebookEntryId_idx" ON "NotebookAttachment"("notebookEntryId");

-- AddForeignKey
ALTER TABLE "NotebookAttachment" ADD CONSTRAINT "NotebookAttachment_notebookEntryId_fkey" FOREIGN KEY ("notebookEntryId") REFERENCES "NotebookEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

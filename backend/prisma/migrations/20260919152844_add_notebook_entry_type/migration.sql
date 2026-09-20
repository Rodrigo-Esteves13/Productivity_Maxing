-- CreateEnum
CREATE TYPE "NotebookEntryType" AS ENUM ('NOTE', 'STUDY', 'CLASS');

-- AlterTable
ALTER TABLE "NotebookEntry" ADD COLUMN     "classNumber" INTEGER,
ADD COLUMN     "entryType" "NotebookEntryType" NOT NULL DEFAULT 'NOTE';

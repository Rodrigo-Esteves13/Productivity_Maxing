-- AlterTable
ALTER TABLE "StudySession" ADD COLUMN     "focusRating" INTEGER,
ADD COLUMN     "isManual" BOOLEAN NOT NULL DEFAULT false;

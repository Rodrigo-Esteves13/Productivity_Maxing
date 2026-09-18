-- AlterTable
ALTER TABLE "User" ADD COLUMN     "campusAddress" TEXT,
ADD COLUMN     "commuteMinutes" INTEGER,
ADD COLUMN     "homeAddress" TEXT,
ADD COLUMN     "quietHoursEnd" INTEGER,
ADD COLUMN     "quietHoursStart" INTEGER;

-- CreateTable
CREATE TABLE "ClassOccurrence" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "location" TEXT,
    "professor" TEXT,
    "externalUid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClassOccurrence_userId_idx" ON "ClassOccurrence"("userId");

-- CreateIndex
CREATE INDEX "ClassOccurrence_userId_date_idx" ON "ClassOccurrence"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ClassOccurrence_userId_externalUid_key" ON "ClassOccurrence"("userId", "externalUid");

-- AddForeignKey
ALTER TABLE "ClassOccurrence" ADD CONSTRAINT "ClassOccurrence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dailyStudyLimitMinutes" INTEGER;

-- CreateTable
CREATE TABLE "WorkShift" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayOfWeek" INTEGER,
    "date" TIMESTAMP(3),
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 0,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarSyncedEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "googleEventId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "windowDate" TIMESTAMP(3) NOT NULL,
    "endMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarSyncedEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkShift_userId_idx" ON "WorkShift"("userId");

-- CreateIndex
CREATE INDEX "WorkShift_userId_date_idx" ON "WorkShift"("userId", "date");

-- CreateIndex
CREATE INDEX "CalendarSyncedEvent_userId_windowDate_idx" ON "CalendarSyncedEvent"("userId", "windowDate");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarSyncedEvent_userId_sourceKey_key" ON "CalendarSyncedEvent"("userId", "sourceKey");

-- AddForeignKey
ALTER TABLE "WorkShift" ADD CONSTRAINT "WorkShift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarSyncedEvent" ADD CONSTRAINT "CalendarSyncedEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "recurrenceFrequency" "RecurrenceFrequency",
ADD COLUMN     "recurrenceInterval" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "recurrenceUntil" TIMESTAMP(3),
ADD COLUMN     "spacedReviewOfTaskId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deadlineEmailReminders" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "spacedReviewsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twoFactorEnabledAt" TIMESTAMP(3),
ADD COLUMN     "twoFactorLastStep" INTEGER,
ADD COLUMN     "twoFactorRecoveryHashes" TEXT[],
ADD COLUMN     "twoFactorSecret" TEXT;

-- CreateTable
CREATE TABLE "SentReminder" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "taskDate" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SentReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SentReminder_taskId_taskDate_key" ON "SentReminder"("taskId", "taskDate");

-- CreateIndex
CREATE INDEX "Task_spacedReviewOfTaskId_idx" ON "Task"("spacedReviewOfTaskId");

-- AddForeignKey
ALTER TABLE "SentReminder" ADD CONSTRAINT "SentReminder_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "ScheduleExceptionKind" AS ENUM ('OFF', 'RETIME');

-- AlterTable
ALTER TABLE "ClassOccurrence" ADD COLUMN     "cancelled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Commitment" ADD COLUMN     "worksOnHolidays" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "onTime" BOOLEAN,
ADD COLUMN     "submissionDate" TIMESTAMP(3),
ADD COLUMN     "submissionOnTime" BOOLEAN;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "allowEmailFriendRequests" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "ScheduleException" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shiftId" TEXT,
    "commitmentId" TEXT,
    "kind" "ScheduleExceptionKind" NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3) NOT NULL,
    "startMinutes" INTEGER,
    "endMinutes" INTEGER,
    "note" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleException_userId_endsOn_idx" ON "ScheduleException"("userId", "endsOn");

-- CreateIndex
CREATE INDEX "ScheduleException_shiftId_idx" ON "ScheduleException"("shiftId");

-- CreateIndex
CREATE INDEX "ScheduleException_commitmentId_idx" ON "ScheduleException"("commitmentId");

-- AddForeignKey
ALTER TABLE "ScheduleException" ADD CONSTRAINT "ScheduleException_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleException" ADD CONSTRAINT "ScheduleException_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "WorkShift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleException" ADD CONSTRAINT "ScheduleException_commitmentId_fkey" FOREIGN KEY ("commitmentId") REFERENCES "Commitment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

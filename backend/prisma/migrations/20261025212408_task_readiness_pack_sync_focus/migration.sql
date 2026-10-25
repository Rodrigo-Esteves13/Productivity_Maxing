-- CreateEnum
CREATE TYPE "Effort" AS ENUM ('LIGHT', 'MODERATE', 'HEAVY', 'EXHAUSTIVE');

-- CreateEnum
CREATE TYPE "DateCertainty" AS ENUM ('EXACT', 'APPROXIMATE', 'UNKNOWN', 'SURPRISE');

-- CreateEnum
CREATE TYPE "TaskPackUpdateStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- AlterTable
ALTER TABLE "AgentConfig" ADD COLUMN     "blockDuringFocus" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "StudySession" ADD COLUMN     "distractionCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "availableFrom" TIMESTAMP(3),
ADD COLUMN     "dateCertainty" "DateCertainty" NOT NULL DEFAULT 'EXACT',
ADD COLUMN     "effort" "Effort",
ADD COLUMN     "isBlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "packItemId" TEXT,
ADD COLUMN     "packItemVersion" INTEGER;

-- AlterTable
ALTER TABLE "TaskPackItem" ADD COLUMN     "availableFrom" TIMESTAMP(3),
ADD COLUMN     "dateCertainty" "DateCertainty" NOT NULL DEFAULT 'EXACT',
ADD COLUMN     "effort" "Effort",
ADD COLUMN     "sourceTaskId" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "TaskPackUpdate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "packItemId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "changes" JSONB NOT NULL,
    "status" "TaskPackUpdateStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "TaskPackUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskPackUpdate_userId_status_idx" ON "TaskPackUpdate"("userId", "status");

-- CreateIndex
CREATE INDEX "TaskPackUpdate_taskId_status_idx" ON "TaskPackUpdate"("taskId", "status");

-- CreateIndex
CREATE INDEX "TaskPackUpdate_packItemId_idx" ON "TaskPackUpdate"("packItemId");

-- CreateIndex
CREATE INDEX "Task_packItemId_idx" ON "Task"("packItemId");

-- CreateIndex
CREATE INDEX "TaskPackItem_sourceTaskId_idx" ON "TaskPackItem"("sourceTaskId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_packItemId_fkey" FOREIGN KEY ("packItemId") REFERENCES "TaskPackItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskPackItem" ADD CONSTRAINT "TaskPackItem_sourceTaskId_fkey" FOREIGN KEY ("sourceTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskPackUpdate" ADD CONSTRAINT "TaskPackUpdate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskPackUpdate" ADD CONSTRAINT "TaskPackUpdate_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskPackUpdate" ADD CONSTRAINT "TaskPackUpdate_packItemId_fkey" FOREIGN KEY ("packItemId") REFERENCES "TaskPackItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

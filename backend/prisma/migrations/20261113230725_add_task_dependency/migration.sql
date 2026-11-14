-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "blockedByTaskId" TEXT;

-- CreateIndex
CREATE INDEX "Task_blockedByTaskId_idx" ON "Task"("blockedByTaskId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_blockedByTaskId_fkey" FOREIGN KEY ("blockedByTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

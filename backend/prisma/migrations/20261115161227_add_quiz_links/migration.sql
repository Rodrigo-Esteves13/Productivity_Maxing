-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN     "areaId" TEXT,
ADD COLUMN     "taskId" TEXT;

-- CreateIndex
CREATE INDEX "Quiz_areaId_idx" ON "Quiz"("areaId");

-- CreateIndex
CREATE INDEX "Quiz_taskId_idx" ON "Quiz"("taskId");

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

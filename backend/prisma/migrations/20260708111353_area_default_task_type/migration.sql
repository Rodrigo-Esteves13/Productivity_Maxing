-- AlterTable
ALTER TABLE "Area" ADD COLUMN     "defaultTaskTypeId" TEXT;

-- AddForeignKey
ALTER TABLE "Area" ADD CONSTRAINT "Area_defaultTaskTypeId_fkey" FOREIGN KEY ("defaultTaskTypeId") REFERENCES "TaskType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

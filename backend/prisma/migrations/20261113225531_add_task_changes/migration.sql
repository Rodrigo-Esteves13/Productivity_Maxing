-- CreateTable
CREATE TABLE "TaskChange" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskChange_taskId_createdAt_idx" ON "TaskChange"("taskId", "createdAt");

-- AddForeignKey
ALTER TABLE "TaskChange" ADD CONSTRAINT "TaskChange_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

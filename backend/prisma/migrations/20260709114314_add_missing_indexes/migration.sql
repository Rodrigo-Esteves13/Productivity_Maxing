-- CreateIndex
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");

-- CreateIndex
CREATE INDEX "Identity_userId_idx" ON "Identity"("userId");

-- CreateIndex
CREATE INDEX "Task_userId_idx" ON "Task"("userId");

-- CreateIndex
CREATE INDEX "Task_areaId_idx" ON "Task"("areaId");

-- CreateIndex
CREATE INDEX "Task_taskTypeId_idx" ON "Task"("taskTypeId");

-- CreateIndex
CREATE INDEX "Task_academicTypeId_idx" ON "Task"("academicTypeId");

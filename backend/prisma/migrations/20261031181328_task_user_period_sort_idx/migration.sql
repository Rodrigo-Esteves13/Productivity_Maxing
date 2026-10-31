-- CreateIndex
CREATE INDEX "Task_userId_periodId_sortOrder_date_idx" ON "Task"("userId", "periodId", "sortOrder", "date");

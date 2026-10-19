-- DropIndex
DROP INDEX "BannedIp_ip_idx";

-- DropIndex
DROP INDEX "NotebookShare_token_idx";

-- CreateIndex
CREATE INDEX "Task_userId_date_idx" ON "Task"("userId", "date");

-- CreateIndex
CREATE INDEX "Task_date_idx" ON "Task"("date");

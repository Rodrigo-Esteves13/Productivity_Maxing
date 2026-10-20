-- CreateIndex
CREATE INDEX "NotebookShareAccessRequest_requestingUserId_status_idx" ON "NotebookShareAccessRequest"("requestingUserId", "status");

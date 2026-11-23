-- CreateIndex
CREATE INDEX "Feedback_userId_idx" ON "Feedback"("userId");

-- CreateIndex
CREATE INDEX "NotebookEntry_areaId_idx" ON "NotebookEntry"("areaId");

-- CreateIndex
CREATE INDEX "NotebookEntry_classOccurrenceId_idx" ON "NotebookEntry"("classOccurrenceId");

-- CreateIndex
CREATE INDEX "Pad_updatedById_idx" ON "Pad"("updatedById");

-- CreateIndex
CREATE INDEX "Pad_lockedById_idx" ON "Pad"("lockedById");

-- CreateIndex
CREATE INDEX "Task_submissionDate_idx" ON "Task"("submissionDate");

-- CreateIndex
CREATE INDEX "TurmaAnnouncement_authorId_idx" ON "TurmaAnnouncement"("authorId");

-- CreateIndex
CREATE INDEX "TurmaFile_uploadedById_idx" ON "TurmaFile"("uploadedById");

-- CreateIndex
CREATE INDEX "TurmaLinkedArea_userId_idx" ON "TurmaLinkedArea"("userId");

-- CreateIndex
CREATE INDEX "TurmaLinkedArea_areaId_idx" ON "TurmaLinkedArea"("areaId");

-- CreateIndex
CREATE INDEX "TurmaNote_createdById_idx" ON "TurmaNote"("createdById");

-- CreateIndex
CREATE INDEX "TurmaNote_updatedById_idx" ON "TurmaNote"("updatedById");

-- CreateIndex
CREATE INDEX "TurmaPack_sharedById_idx" ON "TurmaPack"("sharedById");

-- CreateIndex
CREATE INDEX "TurmaPack_packId_idx" ON "TurmaPack"("packId");

-- CreateIndex
CREATE INDEX "TurmaProgram_sharedById_idx" ON "TurmaProgram"("sharedById");

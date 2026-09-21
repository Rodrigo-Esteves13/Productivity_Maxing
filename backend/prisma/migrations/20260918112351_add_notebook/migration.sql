-- CreateTable
CREATE TABLE "AreaScheduleLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "scheduleSubject" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AreaScheduleLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotebookEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "classOccurrenceId" TEXT,
    "title" TEXT NOT NULL,
    "textContent" TEXT,
    "drawingStrokes" JSONB,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotebookEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotebookPhoto" (
    "id" TEXT NOT NULL,
    "notebookEntryId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotebookPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AreaScheduleLink_userId_areaId_idx" ON "AreaScheduleLink"("userId", "areaId");

-- CreateIndex
CREATE UNIQUE INDEX "AreaScheduleLink_userId_scheduleSubject_key" ON "AreaScheduleLink"("userId", "scheduleSubject");

-- CreateIndex
CREATE INDEX "NotebookEntry_userId_areaId_date_idx" ON "NotebookEntry"("userId", "areaId", "date");

-- CreateIndex
CREATE INDEX "NotebookPhoto_notebookEntryId_idx" ON "NotebookPhoto"("notebookEntryId");

-- AddForeignKey
ALTER TABLE "AreaScheduleLink" ADD CONSTRAINT "AreaScheduleLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AreaScheduleLink" ADD CONSTRAINT "AreaScheduleLink_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotebookEntry" ADD CONSTRAINT "NotebookEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotebookEntry" ADD CONSTRAINT "NotebookEntry_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotebookEntry" ADD CONSTRAINT "NotebookEntry_classOccurrenceId_fkey" FOREIGN KEY ("classOccurrenceId") REFERENCES "ClassOccurrence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotebookPhoto" ADD CONSTRAINT "NotebookPhoto_notebookEntryId_fkey" FOREIGN KEY ("notebookEntryId") REFERENCES "NotebookEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

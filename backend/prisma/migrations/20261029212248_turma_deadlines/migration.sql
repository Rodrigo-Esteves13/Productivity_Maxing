-- CreateTable
CREATE TABLE "TurmaDeadline" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "createdById" TEXT,
    "title" VARCHAR(200) NOT NULL,
    "subject" VARCHAR(120) NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "weightPercentage" DOUBLE PRECISION,
    "kind" VARCHAR(40) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TurmaDeadline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TurmaDeadlineTask" (
    "id" TEXT NOT NULL,
    "deadlineId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TurmaDeadlineTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TurmaDeadline_turmaId_dueAt_idx" ON "TurmaDeadline"("turmaId", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "TurmaDeadlineTask_taskId_key" ON "TurmaDeadlineTask"("taskId");

-- CreateIndex
CREATE INDEX "TurmaDeadlineTask_userId_idx" ON "TurmaDeadlineTask"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TurmaDeadlineTask_deadlineId_userId_key" ON "TurmaDeadlineTask"("deadlineId", "userId");

-- AddForeignKey
ALTER TABLE "TurmaDeadline" ADD CONSTRAINT "TurmaDeadline_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurmaDeadline" ADD CONSTRAINT "TurmaDeadline_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurmaDeadlineTask" ADD CONSTRAINT "TurmaDeadlineTask_deadlineId_fkey" FOREIGN KEY ("deadlineId") REFERENCES "TurmaDeadline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurmaDeadlineTask" ADD CONSTRAINT "TurmaDeadlineTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurmaDeadlineTask" ADD CONSTRAINT "TurmaDeadlineTask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

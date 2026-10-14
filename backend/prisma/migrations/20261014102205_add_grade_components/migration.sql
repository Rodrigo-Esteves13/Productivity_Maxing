-- CreateEnum
CREATE TYPE "GradeAggregation" AS ENUM ('AVERAGE', 'BEST_OF', 'DROP_LOWEST');

-- CreateEnum
CREATE TYPE "ShareAccessRole" AS ENUM ('VIEWER', 'EDITOR', 'CO_OWNER');

-- CreateEnum
CREATE TYPE "ChangeProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "NotebookShareAccessRequest" ADD COLUMN     "accessRole" "ShareAccessRole" NOT NULL DEFAULT 'VIEWER';

-- CreateTable
CREATE TABLE "GradeComponent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weightPercentage" DOUBLE PRECISION NOT NULL,
    "aggregation" "GradeAggregation" NOT NULL DEFAULT 'AVERAGE',
    "bestOfCount" INTEGER,
    "expectedEntries" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradeComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeEntry" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "label" TEXT,
    "grade" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GradeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotebookChangeProposal" (
    "id" TEXT NOT NULL,
    "notebookEntryId" TEXT NOT NULL,
    "proposedByUserId" TEXT NOT NULL,
    "status" "ChangeProposalStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "NotebookChangeProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GradeComponent_userId_periodId_idx" ON "GradeComponent"("userId", "periodId");

-- CreateIndex
CREATE INDEX "GradeComponent_areaId_idx" ON "GradeComponent"("areaId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeComponent_userId_areaId_periodId_name_key" ON "GradeComponent"("userId", "areaId", "periodId", "name");

-- CreateIndex
CREATE INDEX "GradeEntry_componentId_idx" ON "GradeEntry"("componentId");

-- CreateIndex
CREATE INDEX "NotebookChangeProposal_notebookEntryId_status_idx" ON "NotebookChangeProposal"("notebookEntryId", "status");

-- CreateIndex
CREATE INDEX "NotebookChangeProposal_proposedByUserId_idx" ON "NotebookChangeProposal"("proposedByUserId");

-- AddForeignKey
ALTER TABLE "GradeComponent" ADD CONSTRAINT "GradeComponent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeComponent" ADD CONSTRAINT "GradeComponent_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeComponent" ADD CONSTRAINT "GradeComponent_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AcademicPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeEntry" ADD CONSTRAINT "GradeEntry_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "GradeComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotebookChangeProposal" ADD CONSTRAINT "NotebookChangeProposal_notebookEntryId_fkey" FOREIGN KEY ("notebookEntryId") REFERENCES "NotebookEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotebookChangeProposal" ADD CONSTRAINT "NotebookChangeProposal_proposedByUserId_fkey" FOREIGN KEY ("proposedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

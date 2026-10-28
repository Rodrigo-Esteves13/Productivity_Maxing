-- CreateEnum
CREATE TYPE "FeedbackResolution" AS ENUM ('DONE', 'REJECTED');

-- AlterTable
ALTER TABLE "Feedback" ADD COLUMN     "adminReply" TEXT,
ADD COLUMN     "repliedAt" TIMESTAMP(3),
ADD COLUMN     "resolution" "FeedbackResolution";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "feedbackMutedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TurmaPack" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "sharedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TurmaPack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TurmaPack_turmaId_idx" ON "TurmaPack"("turmaId");

-- CreateIndex
CREATE UNIQUE INDEX "TurmaPack_turmaId_packId_key" ON "TurmaPack"("turmaId", "packId");

-- AddForeignKey
ALTER TABLE "TurmaPack" ADD CONSTRAINT "TurmaPack_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurmaPack" ADD CONSTRAINT "TurmaPack_packId_fkey" FOREIGN KEY ("packId") REFERENCES "TaskPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurmaPack" ADD CONSTRAINT "TurmaPack_sharedById_fkey" FOREIGN KEY ("sharedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

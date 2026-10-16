-- CreateEnum
CREATE TYPE "AreaProposalStatus" AS ENUM ('NONE', 'PENDING', 'REJECTED');

-- CreateEnum
CREATE TYPE "FeedbackCategory" AS ENUM ('BUG', 'IDEA', 'TRANSLATION', 'CONFUSING', 'OTHER');

-- AlterTable
ALTER TABLE "Area" ADD COLUMN     "ownerId" TEXT,
ADD COLUMN     "proposalReviewNote" TEXT,
ADD COLUMN     "proposalStatus" "AreaProposalStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "proposedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AreaHidden" (
    "userId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AreaHidden_pkey" PRIMARY KEY ("userId","areaId")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "lang" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareVisit" (
    "id" TEXT NOT NULL,
    "notebookShareId" TEXT NOT NULL,
    "viewerKey" TEXT NOT NULL,
    "viewerUserId" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,
    "firstVisitAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastVisitAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "category" "FeedbackCategory" NOT NULL DEFAULT 'OTHER',
    "rating" INTEGER,
    "message" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "page" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AreaHidden_areaId_idx" ON "AreaHidden"("areaId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "ShareVisit_notebookShareId_lastVisitAt_idx" ON "ShareVisit"("notebookShareId", "lastVisitAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShareVisit_notebookShareId_viewerKey_key" ON "ShareVisit"("notebookShareId", "viewerKey");

-- CreateIndex
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");

-- CreateIndex
CREATE INDEX "Feedback_isResolved_createdAt_idx" ON "Feedback"("isResolved", "createdAt");

-- CreateIndex
CREATE INDEX "Area_ownerId_idx" ON "Area"("ownerId");

-- CreateIndex
CREATE INDEX "Area_proposalStatus_idx" ON "Area"("proposalStatus");

-- AddForeignKey
ALTER TABLE "Area" ADD CONSTRAINT "Area_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AreaHidden" ADD CONSTRAINT "AreaHidden_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AreaHidden" ADD CONSTRAINT "AreaHidden_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareVisit" ADD CONSTRAINT "ShareVisit_notebookShareId_fkey" FOREIGN KEY ("notebookShareId") REFERENCES "NotebookShare"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareVisit" ADD CONSTRAINT "ShareVisit_viewerUserId_fkey" FOREIGN KEY ("viewerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

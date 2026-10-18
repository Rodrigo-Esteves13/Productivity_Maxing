-- CreateTable
CREATE TABLE "NotebookViewGrant" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "status" "ShareAccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "areaIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "NotebookViewGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotebookViewGrant_viewerId_status_idx" ON "NotebookViewGrant"("viewerId", "status");

-- CreateIndex
CREATE INDEX "NotebookViewGrant_ownerId_status_idx" ON "NotebookViewGrant"("ownerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "NotebookViewGrant_ownerId_viewerId_key" ON "NotebookViewGrant"("ownerId", "viewerId");

-- AddForeignKey
ALTER TABLE "NotebookViewGrant" ADD CONSTRAINT "NotebookViewGrant_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotebookViewGrant" ADD CONSTRAINT "NotebookViewGrant_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

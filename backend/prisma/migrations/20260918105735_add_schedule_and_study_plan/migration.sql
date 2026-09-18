-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "BannedIp" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bannedByUserId" TEXT,

    CONSTRAINT "BannedIp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BannedIp_ip_key" ON "BannedIp"("ip");

-- CreateIndex
CREATE INDEX "BannedIp_ip_idx" ON "BannedIp"("ip");

-- CreateIndex
CREATE INDEX "Task_userId_sortOrder_idx" ON "Task"("userId", "sortOrder");

-- AddForeignKey
ALTER TABLE "BannedIp" ADD CONSTRAINT "BannedIp_bannedByUserId_fkey" FOREIGN KEY ("bannedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

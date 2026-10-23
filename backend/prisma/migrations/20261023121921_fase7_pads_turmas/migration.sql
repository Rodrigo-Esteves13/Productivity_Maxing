-- AlterEnum
ALTER TYPE "SecurityEventType" ADD VALUE 'ADMIN_PAD_SOURCE_BLOCKED';

-- AlterTable
ALTER TABLE "Pad" ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "lockedById" TEXT,
ADD COLUMN     "updatedByIpHash" VARCHAR(64);

-- CreateTable
CREATE TABLE "PadBlockedSource" (
    "ipHash" VARCHAR(64) NOT NULL,
    "blockedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PadBlockedSource_pkey" PRIMARY KEY ("ipHash")
);

-- CreateIndex
CREATE INDEX "Pad_updatedAt_idx" ON "Pad"("updatedAt");

-- CreateIndex
CREATE INDEX "Pad_updatedByIpHash_idx" ON "Pad"("updatedByIpHash");

-- AddForeignKey
ALTER TABLE "Pad" ADD CONSTRAINT "Pad_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PadBlockedSource" ADD CONSTRAINT "PadBlockedSource_blockedById_fkey" FOREIGN KEY ("blockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

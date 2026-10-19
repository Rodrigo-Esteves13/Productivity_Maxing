-- CreateEnum
CREATE TYPE "FriendCodeChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "FriendCodeChangeRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "status" "FriendCodeChangeStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" VARCHAR(300),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,

    CONSTRAINT "FriendCodeChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FriendCodeChangeRequest_status_createdAt_idx" ON "FriendCodeChangeRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "FriendCodeChangeRequest_userId_createdAt_idx" ON "FriendCodeChangeRequest"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "FriendCodeChangeRequest" ADD CONSTRAINT "FriendCodeChangeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

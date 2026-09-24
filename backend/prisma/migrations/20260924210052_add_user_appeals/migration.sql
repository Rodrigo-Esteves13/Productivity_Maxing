-- CreateEnum
CREATE TYPE "AppealResolution" AS ENUM ('APPROVED', 'DENIED');

-- CreateTable
CREATE TABLE "UserAppeal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "statusAtSubmission" "UserStatus" NOT NULL,
    "reasonAtSubmission" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolution" "AppealResolution",
    "resolutionNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,

    CONSTRAINT "UserAppeal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserAppeal_userId_idx" ON "UserAppeal"("userId");

-- CreateIndex
CREATE INDEX "UserAppeal_resolvedAt_idx" ON "UserAppeal"("resolvedAt");

-- AddForeignKey
ALTER TABLE "UserAppeal" ADD CONSTRAINT "UserAppeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAppeal" ADD CONSTRAINT "UserAppeal_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

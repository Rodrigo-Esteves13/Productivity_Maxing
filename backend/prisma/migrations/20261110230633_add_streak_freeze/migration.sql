-- CreateTable
CREATE TABLE "StreakFreeze" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StreakFreeze_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StreakFreeze_userId_createdAt_idx" ON "StreakFreeze"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StreakFreeze_userId_dateKey_key" ON "StreakFreeze"("userId", "dateKey");

-- AddForeignKey
ALTER TABLE "StreakFreeze" ADD CONSTRAINT "StreakFreeze_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

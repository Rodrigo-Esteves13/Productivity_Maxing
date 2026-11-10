-- CreateTable
CREATE TABLE "SentNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SentNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SentNotification_createdAt_idx" ON "SentNotification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SentNotification_userId_kind_periodKey_key" ON "SentNotification"("userId", "kind", "periodKey");

-- AddForeignKey
ALTER TABLE "SentNotification" ADD CONSTRAINT "SentNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

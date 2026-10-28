-- CreateEnum
CREATE TYPE "FinanceEntryKind" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "FinanceGoalKind" AS ENUM ('SAVINGS', 'INVESTMENT', 'WISHLIST', 'LONG_TERM');

-- CreateTable
CREATE TABLE "FinanceSettings" (
    "userId" TEXT NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'EUR',
    "balanceCents" INTEGER NOT NULL DEFAULT 0,
    "monthlyBudgetCents" INTEGER,
    "leisureBudgetCents" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceSettings_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "FinanceEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "FinanceEntryKind" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "category" VARCHAR(20) NOT NULL,
    "note" VARCHAR(120),
    "date" TIMESTAMP(3) NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "FinanceGoalKind" NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "targetCents" INTEGER NOT NULL,
    "savedCents" INTEGER NOT NULL DEFAULT 0,
    "deadline" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinanceEntry_userId_date_idx" ON "FinanceEntry"("userId", "date");

-- CreateIndex
CREATE INDEX "FinanceGoal_userId_idx" ON "FinanceGoal"("userId");

-- AddForeignKey
ALTER TABLE "FinanceSettings" ADD CONSTRAINT "FinanceSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceGoal" ADD CONSTRAINT "FinanceGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

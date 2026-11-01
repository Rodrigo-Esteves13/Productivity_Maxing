-- CreateEnum
CREATE TYPE "FinanceFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "FinancePayDayRule" AS ENUM ('FIXED_DAY', 'FIRST_BUSINESS_DAY', 'FIRST_BUSINESS_DAY_NEXT_MONTH', 'LAST_BUSINESS_DAY', 'LAST_FRIDAY');

-- CreateEnum
CREATE TYPE "FinanceAccountType" AS ENUM ('BANK', 'LIVE', 'INVESTMENT', 'CRYPTO', 'CASH', 'OTHER');

-- AlterEnum
ALTER TYPE "ProgressStatus" ADD VALUE 'NOT_STARTED';

-- AlterTable
ALTER TABLE "FinanceEntry" ADD COLUMN     "accountId" TEXT,
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "frequency" "FinanceFrequency",
ADD COLUMN     "payDay" INTEGER,
ADD COLUMN     "payDayRule" "FinancePayDayRule";

-- CreateTable
CREATE TABLE "FinanceAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "type" "FinanceAccountType" NOT NULL,
    "balanceCents" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceHolding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT,
    "symbol" VARCHAR(20) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "lastPriceCents" INTEGER,
    "priceCurrency" VARCHAR(3),
    "priceUpdatedAt" TIMESTAMP(3),
    "costBasisCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceHolding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinanceAccount_userId_idx" ON "FinanceAccount"("userId");

-- CreateIndex
CREATE INDEX "FinanceHolding_userId_idx" ON "FinanceHolding"("userId");

-- CreateIndex
CREATE INDEX "FinanceHolding_symbol_idx" ON "FinanceHolding"("symbol");

-- CreateIndex
CREATE INDEX "FinanceEntry_accountId_idx" ON "FinanceEntry"("accountId");

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinanceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceAccount" ADD CONSTRAINT "FinanceAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceHolding" ADD CONSTRAINT "FinanceHolding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceHolding" ADD CONSTRAINT "FinanceHolding_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinanceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

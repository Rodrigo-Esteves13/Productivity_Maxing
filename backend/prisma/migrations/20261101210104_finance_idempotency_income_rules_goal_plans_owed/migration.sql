/*
  Warnings:

  - A unique constraint covering the columns `[userId,clientRequestId]` on the table `FinanceAccount` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,clientRequestId]` on the table `FinanceEntry` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,clientRequestId]` on the table `FinanceGoal` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,clientRequestId]` on the table `FinanceHolding` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "FinanceInterestKind" AS ENUM ('NONE', 'SIMPLE', 'MONTHLY_COMPOUND');

-- AlterTable
ALTER TABLE "FinanceAccount" ADD COLUMN     "clientRequestId" UUID;

-- AlterTable
ALTER TABLE "FinanceEntry" ADD COLUMN     "clientRequestId" UUID,
ADD COLUMN     "debtorName" VARCHAR(80),
ADD COLUMN     "expectedDate" TIMESTAMP(3),
ADD COLUMN     "interestKind" "FinanceInterestKind",
ADD COLUMN     "interestRatePct" DECIMAL(6,3),
ADD COLUMN     "isOwed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "latePaymentRiskPct" INTEGER,
ADD COLUMN     "paidInArrearsMonths" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "receivedAt" TIMESTAMP(3),
ADD COLUMN     "skipFirstOccurrences" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "withheldCents" INTEGER;

-- AlterTable
ALTER TABLE "FinanceGoal" ADD COLUMN     "clientRequestId" UUID,
ADD COLUMN     "monthlyPlanCents" INTEGER;

-- AlterTable
ALTER TABLE "FinanceHolding" ADD COLUMN     "clientRequestId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "FinanceAccount_userId_clientRequestId_key" ON "FinanceAccount"("userId", "clientRequestId");

-- CreateIndex
CREATE INDEX "FinanceEntry_userId_isOwed_idx" ON "FinanceEntry"("userId", "isOwed");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceEntry_userId_clientRequestId_key" ON "FinanceEntry"("userId", "clientRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceGoal_userId_clientRequestId_key" ON "FinanceGoal"("userId", "clientRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceHolding_userId_clientRequestId_key" ON "FinanceHolding"("userId", "clientRequestId");

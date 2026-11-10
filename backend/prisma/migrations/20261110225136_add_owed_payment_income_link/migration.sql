/*
  Warnings:

  - A unique constraint covering the columns `[incomeEntryId]` on the table `FinanceOwedPayment` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "FinanceOwedPayment" ADD COLUMN     "incomeEntryId" TEXT,
ADD COLUMN     "settledDebt" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "FinanceOwedPayment_incomeEntryId_key" ON "FinanceOwedPayment"("incomeEntryId");

-- AddForeignKey
ALTER TABLE "FinanceOwedPayment" ADD CONSTRAINT "FinanceOwedPayment_incomeEntryId_fkey" FOREIGN KEY ("incomeEntryId") REFERENCES "FinanceEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

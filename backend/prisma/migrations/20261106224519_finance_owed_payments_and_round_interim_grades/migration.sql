-- AlterTable
ALTER TABLE "AcademicProgram" ADD COLUMN     "roundInterimGrades" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "FinanceOwedPayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entryId" TEXT,
    "debtorName" VARCHAR(80),
    "amountCents" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceOwedPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinanceOwedPayment_userId_paidAt_idx" ON "FinanceOwedPayment"("userId", "paidAt");

-- CreateIndex
CREATE INDEX "FinanceOwedPayment_entryId_idx" ON "FinanceOwedPayment"("entryId");

-- AddForeignKey
ALTER TABLE "FinanceOwedPayment" ADD CONSTRAINT "FinanceOwedPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceOwedPayment" ADD CONSTRAINT "FinanceOwedPayment_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "FinanceEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

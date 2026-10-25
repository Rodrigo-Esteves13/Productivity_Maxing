-- CreateEnum
CREATE TYPE "MedicationSchedule" AS ENUM ('DAILY', 'AS_NEEDED');

-- CreateEnum
CREATE TYPE "DrugClass" AS ENUM ('OTHER', 'BENZODIAZEPINE', 'Z_DRUG', 'OPIOID', 'TRAMADOL', 'GABAPENTINOID', 'MUSCLE_RELAXANT', 'SEDATING_ANTIHISTAMINE', 'SSRI', 'SNRI', 'TCA', 'MAOI', 'BUPROPION', 'ANTIPSYCHOTIC', 'LITHIUM', 'VALPROATE', 'STIMULANT', 'TRIPTAN', 'NSAID', 'PARACETAMOL');

-- CreateEnum
CREATE TYPE "MedicationIntakeKind" AS ENUM ('MEDICATION', 'ALCOHOL');

-- AlterTable
ALTER TABLE "Medication" ADD COLUMN     "drugClass" "DrugClass" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "habitForming" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "limitMaxConsecutiveDays" INTEGER,
ADD COLUMN     "limitMaxDaysPerWeek" INTEGER,
ADD COLUMN     "limitMaxPerDay" INTEGER,
ADD COLUMN     "schedule" "MedicationSchedule" NOT NULL DEFAULT 'DAILY';

-- CreateTable
CREATE TABLE "MedicationIntake" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "medicationId" TEXT,
    "kind" "MedicationIntakeKind" NOT NULL DEFAULT 'MEDICATION',
    "takenAt" TIMESTAMP(3) NOT NULL,
    "dose" VARCHAR(60),
    "note" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicationIntake_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MedicationIntake_userId_takenAt_idx" ON "MedicationIntake"("userId", "takenAt");

-- CreateIndex
CREATE INDEX "MedicationIntake_medicationId_idx" ON "MedicationIntake"("medicationId");

-- AddForeignKey
ALTER TABLE "MedicationIntake" ADD CONSTRAINT "MedicationIntake_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationIntake" ADD CONSTRAINT "MedicationIntake_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "Medication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

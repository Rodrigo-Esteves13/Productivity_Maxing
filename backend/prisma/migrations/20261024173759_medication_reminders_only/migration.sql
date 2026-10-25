/*
  Warnings:

  - You are about to drop the column `drugClass` on the `Medication` table. All the data in the column will be lost.
  - You are about to drop the column `habitForming` on the `Medication` table. All the data in the column will be lost.
  - You are about to drop the column `limitMaxConsecutiveDays` on the `Medication` table. All the data in the column will be lost.
  - You are about to drop the column `limitMaxDaysPerWeek` on the `Medication` table. All the data in the column will be lost.
  - You are about to drop the column `limitMaxPerDay` on the `Medication` table. All the data in the column will be lost.
  - You are about to drop the column `kind` on the `MedicationIntake` table. All the data in the column will be lost.
  - Made the column `medicationId` on table `MedicationIntake` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Medication" DROP COLUMN "drugClass",
DROP COLUMN "habitForming",
DROP COLUMN "limitMaxConsecutiveDays",
DROP COLUMN "limitMaxDaysPerWeek",
DROP COLUMN "limitMaxPerDay";

-- AlterTable
ALTER TABLE "MedicationIntake" DROP COLUMN "kind",
ALTER COLUMN "medicationId" SET NOT NULL;

-- DropEnum
DROP TYPE "DrugClass";

-- DropEnum
DROP TYPE "MedicationIntakeKind";

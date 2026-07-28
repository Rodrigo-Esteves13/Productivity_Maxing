-- CreateEnum
CREATE TYPE "ApiKeyScope" AS ENUM ('TASKS', 'ADMIN');

-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "scope" "ApiKeyScope" NOT NULL DEFAULT 'TASKS';

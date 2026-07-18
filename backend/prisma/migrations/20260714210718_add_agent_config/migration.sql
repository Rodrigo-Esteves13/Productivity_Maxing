-- CreateEnum
CREATE TYPE "AgentTriggerMode" AS ENUM ('ANY', 'ALL');

-- CreateEnum
CREATE TYPE "AgentFailMode" AS ENUM ('CLOSED', 'OPEN');

-- CreateTable
CREATE TABLE "AgentConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "triggerMode" "AgentTriggerMode" NOT NULL DEFAULT 'ANY',
    "hasOverdueTasks" BOOLEAN NOT NULL DEFAULT true,
    "hasOverdueCheckins" BOOLEAN NOT NULL DEFAULT false,
    "minDifficultyToday" "Difficulty",
    "anyTaskToday" BOOLEAN NOT NULL DEFAULT false,
    "minProgressStatus" "ProgressStatus",
    "blockedProcesses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "blockedDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "failMode" "AgentFailMode" NOT NULL DEFAULT 'CLOSED',
    "pollIntervalSeconds" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentConfig_userId_key" ON "AgentConfig"("userId");

-- AddForeignKey
ALTER TABLE "AgentConfig" ADD CONSTRAINT "AgentConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

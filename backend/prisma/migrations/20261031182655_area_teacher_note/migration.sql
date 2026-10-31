-- CreateEnum
CREATE TYPE "ApprovalRounding" AS ENUM ('NONE', 'UP_TO_INTEGER_AT_HALF');

-- CreateTable
CREATE TABLE "AreaTeacherNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "teacherName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AreaTeacherNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRuleSet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "programId" TEXT,
    "areaId" TEXT,
    "presetKey" VARCHAR(40),
    "scaleMin" DOUBLE PRECISION NOT NULL,
    "scaleMax" DOUBLE PRECISION NOT NULL,
    "passMark" DOUBLE PRECISION NOT NULL,
    "rounding" "ApprovalRounding" NOT NULL DEFAULT 'NONE',
    "componentMinGrade" DOUBLE PRECISION,
    "secondThreshold" DOUBLE PRECISION,
    "maxBelowSecondThreshold" INTEGER,
    "hasExamTrack" BOOLEAN NOT NULL DEFAULT false,
    "hasResitTrack" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRuleSet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AreaTeacherNote_areaId_idx" ON "AreaTeacherNote"("areaId");

-- CreateIndex
CREATE UNIQUE INDEX "AreaTeacherNote_userId_areaId_key" ON "AreaTeacherNote"("userId", "areaId");

-- CreateIndex
CREATE INDEX "ApprovalRuleSet_programId_idx" ON "ApprovalRuleSet"("programId");

-- CreateIndex
CREATE INDEX "ApprovalRuleSet_areaId_idx" ON "ApprovalRuleSet"("areaId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalRuleSet_userId_programId_key" ON "ApprovalRuleSet"("userId", "programId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalRuleSet_userId_areaId_key" ON "ApprovalRuleSet"("userId", "areaId");

-- AddForeignKey
ALTER TABLE "AreaTeacherNote" ADD CONSTRAINT "AreaTeacherNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AreaTeacherNote" ADD CONSTRAINT "AreaTeacherNote_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRuleSet" ADD CONSTRAINT "ApprovalRuleSet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRuleSet" ADD CONSTRAINT "ApprovalRuleSet_programId_fkey" FOREIGN KEY ("programId") REFERENCES "AcademicProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRuleSet" ADD CONSTRAINT "ApprovalRuleSet_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

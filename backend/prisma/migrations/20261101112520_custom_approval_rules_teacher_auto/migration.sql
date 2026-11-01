-- AlterTable
ALTER TABLE "ApprovalRuleSet" ADD COLUMN     "customRules" JSONB;

-- AlterTable
ALTER TABLE "AreaTeacherNote" ADD COLUMN     "autoFromSchedule" BOOLEAN NOT NULL DEFAULT false;

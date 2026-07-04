-- Rename Difficulty enum values from Portuguese to English
ALTER TYPE "Difficulty" RENAME VALUE 'FACIL' TO 'EASY';
ALTER TYPE "Difficulty" RENAME VALUE 'MEDIO' TO 'MEDIUM';
ALTER TYPE "Difficulty" RENAME VALUE 'DIFICIL' TO 'HARD';
ALTER TYPE "Difficulty" RENAME VALUE 'MUITO_DIFICIL' TO 'VERY_HARD';

-- Rename ProgressStatus enum values from Portuguese to English
ALTER TYPE "ProgressStatus" RENAME VALUE 'ADIANTADO' TO 'AHEAD';
ALTER TYPE "ProgressStatus" RENAME VALUE 'TEMPO_ESPERADO' TO 'ON_TRACK';
ALTER TYPE "ProgressStatus" RENAME VALUE 'ATRASADO' TO 'BEHIND';
ALTER TYPE "ProgressStatus" RENAME VALUE 'MUITO_ATRASADO' TO 'VERY_BEHIND';

-- AlterTable: update column default to the renamed value
ALTER TABLE "Task" ALTER COLUMN "progressStatus" SET DEFAULT 'ON_TRACK';

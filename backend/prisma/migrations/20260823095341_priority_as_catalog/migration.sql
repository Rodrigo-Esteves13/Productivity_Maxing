/*
  Rewritten by hand (not the raw Prisma diff) to preserve the 114 existing
  Task.priority values instead of dropping them. Order matters here:
  Postgres won't let a TABLE and an ENUM TYPE share the same name at the
  same time, so the old enum has to be gone before "Priority" the table
  can be created - which means the old values have to be staged as plain
  text first, or they'd be lost the moment the enum is dropped.
*/

-- 1. Stage the old enum values as text before touching the enum type at all
ALTER TABLE "Task" ADD COLUMN "priority_old" TEXT;
UPDATE "Task" SET "priority_old" = "priority"::text;

-- 2. Now safe to drop the old column and the enum type - "Priority" the
--    name is free again after this
ALTER TABLE "Task" DROP COLUMN "priority";
DROP TYPE "Priority";

-- 3. Create the real Priority table
CREATE TABLE "Priority" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "colorHex" TEXT DEFAULT '#808080',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Priority_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Priority_key_key" ON "Priority"("key");

-- 4. Seed the 3 original enum values as real rows (same keys the enum had,
--    so the backfill below matches every existing Task exactly)
INSERT INTO "Priority" ("id", "key", "label", "colorHex", "order", "isActive") VALUES
  (gen_random_uuid()::text, 'LOW', 'Low', '#64748b', 1, true),
  (gen_random_uuid()::text, 'MEDIUM', 'Medium', '#a3a3a3', 2, true),
  (gen_random_uuid()::text, 'HIGH', 'High', '#ef4444', 3, true);

-- 5. Add the new FK column and backfill every Task from the staged text
--    column - this is what carries your 114 existing values across
ALTER TABLE "Task" ADD COLUMN "priorityId" TEXT;

UPDATE "Task" t
SET "priorityId" = p."id"
FROM "Priority" p
WHERE t."priority_old" = p."key";

-- 6. Drop the now-unneeded staging column
ALTER TABLE "Task" DROP COLUMN "priority_old";

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_priorityId_fkey" FOREIGN KEY ("priorityId") REFERENCES "Priority"("id") ON DELETE SET NULL ON UPDATE CASCADE;
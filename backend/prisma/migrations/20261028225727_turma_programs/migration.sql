-- CreateTable
CREATE TABLE "TurmaProgram" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "sharedById" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TurmaProgram_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TurmaProgram_turmaId_idx" ON "TurmaProgram"("turmaId");

-- AddForeignKey
ALTER TABLE "TurmaProgram" ADD CONSTRAINT "TurmaProgram_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurmaProgram" ADD CONSTRAINT "TurmaProgram_sharedById_fkey" FOREIGN KEY ("sharedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "TurmaInvite" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invitedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TurmaInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TurmaInvite_userId_idx" ON "TurmaInvite"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TurmaInvite_turmaId_userId_key" ON "TurmaInvite"("turmaId", "userId");

-- AddForeignKey
ALTER TABLE "TurmaInvite" ADD CONSTRAINT "TurmaInvite_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurmaInvite" ADD CONSTRAINT "TurmaInvite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurmaInvite" ADD CONSTRAINT "TurmaInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

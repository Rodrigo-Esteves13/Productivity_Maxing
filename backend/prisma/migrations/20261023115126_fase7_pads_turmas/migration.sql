-- CreateEnum
CREATE TYPE "TurmaRole" AS ENUM ('DELEGADO', 'MEMBER');

-- AlterEnum
ALTER TYPE "SecurityEventType" ADD VALUE 'ADMIN_PAD_DELETED';

-- CreateTable
CREATE TABLE "Pad" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Turma" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(500),
    "inviteCode" VARCHAR(16) NOT NULL,
    "membersCanEditNotes" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Turma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TurmaMember" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TurmaRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TurmaMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TurmaNote" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TurmaNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TurmaFile" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "storagePath" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TurmaFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TurmaAnnouncement" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "authorId" TEXT,
    "title" VARCHAR(200) NOT NULL,
    "body" VARCHAR(5000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TurmaAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TurmaLinkedArea" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TurmaLinkedArea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Pad_slug_key" ON "Pad"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Turma_inviteCode_key" ON "Turma"("inviteCode");

-- CreateIndex
CREATE INDEX "TurmaMember_userId_idx" ON "TurmaMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TurmaMember_turmaId_userId_key" ON "TurmaMember"("turmaId", "userId");

-- CreateIndex
CREATE INDEX "TurmaNote_turmaId_updatedAt_idx" ON "TurmaNote"("turmaId", "updatedAt");

-- CreateIndex
CREATE INDEX "TurmaFile_turmaId_createdAt_idx" ON "TurmaFile"("turmaId", "createdAt");

-- CreateIndex
CREATE INDEX "TurmaAnnouncement_turmaId_createdAt_idx" ON "TurmaAnnouncement"("turmaId", "createdAt");

-- CreateIndex
CREATE INDEX "TurmaLinkedArea_turmaId_idx" ON "TurmaLinkedArea"("turmaId");

-- CreateIndex
CREATE UNIQUE INDEX "TurmaLinkedArea_turmaId_userId_areaId_key" ON "TurmaLinkedArea"("turmaId", "userId", "areaId");

-- AddForeignKey
ALTER TABLE "Pad" ADD CONSTRAINT "Pad_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turma" ADD CONSTRAINT "Turma_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurmaMember" ADD CONSTRAINT "TurmaMember_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurmaMember" ADD CONSTRAINT "TurmaMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurmaNote" ADD CONSTRAINT "TurmaNote_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurmaNote" ADD CONSTRAINT "TurmaNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurmaNote" ADD CONSTRAINT "TurmaNote_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurmaFile" ADD CONSTRAINT "TurmaFile_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurmaFile" ADD CONSTRAINT "TurmaFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurmaAnnouncement" ADD CONSTRAINT "TurmaAnnouncement_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurmaAnnouncement" ADD CONSTRAINT "TurmaAnnouncement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurmaLinkedArea" ADD CONSTRAINT "TurmaLinkedArea_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurmaLinkedArea" ADD CONSTRAINT "TurmaLinkedArea_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurmaLinkedArea" ADD CONSTRAINT "TurmaLinkedArea_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

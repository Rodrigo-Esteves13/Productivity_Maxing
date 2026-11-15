-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN     "sharedById" TEXT,
ADD COLUMN     "sourceQuizId" TEXT;

-- CreateTable
CREATE TABLE "QuizShare" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "copyCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizShareRecipient" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizShareRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuizShare_quizId_key" ON "QuizShare"("quizId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizShare_token_key" ON "QuizShare"("token");

-- CreateIndex
CREATE INDEX "QuizShareRecipient_userId_idx" ON "QuizShareRecipient"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizShareRecipient_shareId_userId_key" ON "QuizShareRecipient"("shareId", "userId");

-- CreateIndex
CREATE INDEX "Quiz_userId_sourceQuizId_idx" ON "Quiz"("userId", "sourceQuizId");

-- CreateIndex
CREATE INDEX "Quiz_sharedById_idx" ON "Quiz"("sharedById");

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_sharedById_fkey" FOREIGN KEY ("sharedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizShare" ADD CONSTRAINT "QuizShare_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizShareRecipient" ADD CONSTRAINT "QuizShareRecipient_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "QuizShare"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizShareRecipient" ADD CONSTRAINT "QuizShareRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

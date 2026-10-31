-- CreateTable
CREATE TABLE "AreaRating" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "teacherRating" INTEGER,
    "courseLiking" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AreaRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AreaRating_areaId_idx" ON "AreaRating"("areaId");

-- CreateIndex
CREATE UNIQUE INDEX "AreaRating_userId_areaId_key" ON "AreaRating"("userId", "areaId");

-- AddForeignKey
ALTER TABLE "AreaRating" ADD CONSTRAINT "AreaRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AreaRating" ADD CONSTRAINT "AreaRating_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

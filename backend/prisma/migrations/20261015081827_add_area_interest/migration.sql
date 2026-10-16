-- CreateTable
CREATE TABLE "AreaInterest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AreaInterest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AreaInterest_areaId_idx" ON "AreaInterest"("areaId");

-- CreateIndex
CREATE UNIQUE INDEX "AreaInterest_userId_areaId_key" ON "AreaInterest"("userId", "areaId");

-- AddForeignKey
ALTER TABLE "AreaInterest" ADD CONSTRAINT "AreaInterest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AreaInterest" ADD CONSTRAINT "AreaInterest_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

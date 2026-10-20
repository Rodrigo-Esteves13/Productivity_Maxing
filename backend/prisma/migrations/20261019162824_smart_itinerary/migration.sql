-- AlterTable
ALTER TABLE "WorkShift" ADD COLUMN     "address" VARCHAR(300),
ADD COLUMN     "commuteMode" "CommuteMode";

-- CreateTable
CREATE TABLE "TravelTime" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "origin" VARCHAR(300) NOT NULL,
    "destination" VARCHAR(300) NOT NULL,
    "mode" "CommuteMode" NOT NULL,
    "minutes" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravelTime_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TravelTime_userId_origin_destination_mode_key" ON "TravelTime"("userId", "origin", "destination", "mode");

-- AddForeignKey
ALTER TABLE "TravelTime" ADD CONSTRAINT "TravelTime_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

/*
  Warnings:

  - Added the required column `accessToken` to the `OAuthToken` table without a default value. This is not possible if the table is not empty.
  - Added the required column `expiresAt` to the `OAuthToken` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "OAuthToken" ADD COLUMN     "accessToken" TEXT NOT NULL,
ADD COLUMN     "expiresAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "PhienDangNhap" (
    "id" TEXT NOT NULL,
    "nguoiDungId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhienDangNhap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhienDangNhap_nguoiDungId_idx" ON "PhienDangNhap"("nguoiDungId");

-- CreateIndex
CREATE INDEX "PhienDangNhap_expiresAt_idx" ON "PhienDangNhap"("expiresAt");

-- AddForeignKey
ALTER TABLE "PhienDangNhap" ADD CONSTRAINT "PhienDangNhap_nguoiDungId_fkey" FOREIGN KEY ("nguoiDungId") REFERENCES "NguoiDung"("id") ON DELETE CASCADE ON UPDATE CASCADE;

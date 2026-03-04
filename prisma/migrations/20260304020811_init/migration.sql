-- CreateEnum
CREATE TYPE "TimeRangeSpotify" AS ENUM ('SHORT_TERM', 'MEDIUM_TERM', 'LONG_TERM');

-- CreateEnum
CREATE TYPE "NguonGoiY" AS ENUM ('TOP', 'RECENT', 'MIX');

-- CreateEnum
CREATE TYPE "DoChinhXacNgayPhatHanh" AS ENUM ('YEAR', 'MONTH', 'DAY');

-- CreateTable
CREATE TABLE "NguoiDung" (
    "id" TEXT NOT NULL,
    "spotifyId" TEXT NOT NULL,
    "tenHienThi" TEXT,
    "email" TEXT,
    "anhDaiDienUrl" TEXT,
    "quocGia" TEXT,
    "product" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NguoiDung_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthToken" (
    "id" TEXT NOT NULL,
    "nguoiDungId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "scope" TEXT,
    "tokenType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaiDatNguoiDung" (
    "id" TEXT NOT NULL,
    "nguoiDungId" TEXT NOT NULL,
    "soLuongGoiY" INTEGER NOT NULL DEFAULT 20,
    "timeRangeMacDinh" "TimeRangeSpotify" NOT NULL DEFAULT 'MEDIUM_TERM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaiDatNguoiDung_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Album" (
    "id" TEXT NOT NULL,
    "spotifyId" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "ngayPhatHanh" TEXT,
    "doChinhXacNgay" "DoChinhXacNgayPhatHanh",
    "anhBiaUrl" TEXT,
    "spotifyUrl" TEXT,
    "uri" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Album_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NgheSi" (
    "id" TEXT NOT NULL,
    "spotifyId" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "anhUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NgheSi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlbumNgheSi" (
    "albumId" TEXT NOT NULL,
    "ngheSiId" TEXT NOT NULL,
    "viTri" INTEGER,

    CONSTRAINT "AlbumNgheSi_pkey" PRIMARY KEY ("albumId","ngheSiId")
);

-- CreateTable
CREATE TABLE "YeuThichAlbum" (
    "nguoiDungId" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YeuThichAlbum_pkey" PRIMARY KEY ("nguoiDungId","albumId")
);

-- CreateTable
CREATE TABLE "DotGoiY" (
    "id" TEXT NOT NULL,
    "nguoiDungId" TEXT NOT NULL,
    "timeRange" "TimeRangeSpotify" NOT NULL DEFAULT 'MEDIUM_TERM',
    "nguon" "NguonGoiY" NOT NULL DEFAULT 'MIX',
    "ghiChu" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DotGoiY_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoiYAlbum" (
    "id" TEXT NOT NULL,
    "dotGoiYId" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "diem" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lyDo" TEXT,
    "viTri" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoiYAlbum_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NguoiDung_spotifyId_key" ON "NguoiDung"("spotifyId");

-- CreateIndex
CREATE UNIQUE INDEX "NguoiDung_email_key" ON "NguoiDung"("email");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthToken_nguoiDungId_key" ON "OAuthToken"("nguoiDungId");

-- CreateIndex
CREATE UNIQUE INDEX "CaiDatNguoiDung_nguoiDungId_key" ON "CaiDatNguoiDung"("nguoiDungId");

-- CreateIndex
CREATE UNIQUE INDEX "Album_spotifyId_key" ON "Album"("spotifyId");

-- CreateIndex
CREATE UNIQUE INDEX "NgheSi_spotifyId_key" ON "NgheSi"("spotifyId");

-- CreateIndex
CREATE INDEX "AlbumNgheSi_ngheSiId_idx" ON "AlbumNgheSi"("ngheSiId");

-- CreateIndex
CREATE INDEX "AlbumNgheSi_albumId_idx" ON "AlbumNgheSi"("albumId");

-- CreateIndex
CREATE INDEX "YeuThichAlbum_albumId_idx" ON "YeuThichAlbum"("albumId");

-- CreateIndex
CREATE INDEX "DotGoiY_nguoiDungId_createdAt_idx" ON "DotGoiY"("nguoiDungId", "createdAt");

-- CreateIndex
CREATE INDEX "GoiYAlbum_albumId_idx" ON "GoiYAlbum"("albumId");

-- CreateIndex
CREATE INDEX "GoiYAlbum_dotGoiYId_idx" ON "GoiYAlbum"("dotGoiYId");

-- CreateIndex
CREATE UNIQUE INDEX "GoiYAlbum_dotGoiYId_albumId_key" ON "GoiYAlbum"("dotGoiYId", "albumId");

-- AddForeignKey
ALTER TABLE "OAuthToken" ADD CONSTRAINT "OAuthToken_nguoiDungId_fkey" FOREIGN KEY ("nguoiDungId") REFERENCES "NguoiDung"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaiDatNguoiDung" ADD CONSTRAINT "CaiDatNguoiDung_nguoiDungId_fkey" FOREIGN KEY ("nguoiDungId") REFERENCES "NguoiDung"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumNgheSi" ADD CONSTRAINT "AlbumNgheSi_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumNgheSi" ADD CONSTRAINT "AlbumNgheSi_ngheSiId_fkey" FOREIGN KEY ("ngheSiId") REFERENCES "NgheSi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YeuThichAlbum" ADD CONSTRAINT "YeuThichAlbum_nguoiDungId_fkey" FOREIGN KEY ("nguoiDungId") REFERENCES "NguoiDung"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YeuThichAlbum" ADD CONSTRAINT "YeuThichAlbum_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DotGoiY" ADD CONSTRAINT "DotGoiY_nguoiDungId_fkey" FOREIGN KEY ("nguoiDungId") REFERENCES "NguoiDung"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoiYAlbum" ADD CONSTRAINT "GoiYAlbum_dotGoiYId_fkey" FOREIGN KEY ("dotGoiYId") REFERENCES "DotGoiY"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoiYAlbum" ADD CONSTRAINT "GoiYAlbum_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlbumPulse: Recommender + Weekly Drops (post-Spotify pivot)
-- Runs AFTER init + oauth migrations. Requires pgvector for AlbumEmbedding.

CREATE EXTENSION IF NOT EXISTS vector;

-- Drop existing tables (FK order)
DROP TABLE IF EXISTS "GoiYAlbum";
DROP TABLE IF EXISTS "DotGoiY";
DROP TABLE IF EXISTS "YeuThichAlbum";
DROP TABLE IF EXISTS "AlbumNgheSi";
DROP TABLE IF EXISTS "Album";
DROP TABLE IF EXISTS "NgheSi";
DROP TABLE IF EXISTS "PhienDangNhap";
DROP TABLE IF EXISTS "OAuthToken";
DROP TABLE IF EXISTS "CaiDatNguoiDung";
DROP TABLE IF EXISTS "NguoiDung";

-- Drop old enums
DROP TYPE IF EXISTS "DoChinhXacNgayPhatHanh";
DROP TYPE IF EXISTS "NguonGoiY";
DROP TYPE IF EXISTS "TimeRangeSpotify";

-- Create new enums
CREATE TYPE "AlbumSource" AS ENUM ('MUSICBRAINZ', 'LASTFM', 'MANUAL');
CREATE TYPE "WeeklyDropStatus" AS ENUM ('ACTIVE', 'EXPIRED');
CREATE TYPE "UserEventType" AS ENUM ('LIKE', 'DISLIKE', 'SAVE', 'UNSAVE', 'SKIP', 'VIEW');

-- User + Session
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- Core catalog
CREATE TABLE "Artist" (
    "id" TEXT NOT NULL,
    "mbid" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Artist_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Artist_mbid_key" ON "Artist"("mbid");

CREATE TABLE "Album" (
    "id" TEXT NOT NULL,
    "mbid" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "releaseYear" INTEGER,
    "coverUrl" TEXT,
    "description" TEXT,
    "source" "AlbumSource" NOT NULL DEFAULT 'MUSICBRAINZ',
    "popularityListeners" INTEGER,
    "popularityPlaycount" INTEGER,
    "popularityScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Album_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Album_mbid_key" ON "Album"("mbid");
CREATE INDEX "Album_artistId_idx" ON "Album"("artistId");
CREATE INDEX "Album_releaseYear_idx" ON "Album"("releaseYear");

CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

CREATE TABLE "AlbumTag" (
    "albumId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlbumTag_pkey" PRIMARY KEY ("albumId","tagId")
);

CREATE INDEX "AlbumTag_tagId_idx" ON "AlbumTag"("tagId");

-- Embeddings (pgvector)
CREATE TABLE "AlbumEmbedding" (
    "id" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "embedding" vector(384),
    "modelVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlbumEmbedding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AlbumEmbedding_albumId_key" ON "AlbumEmbedding"("albumId");

-- User taste + feedback
CREATE TABLE "UserFavoriteAlbum" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserFavoriteAlbum_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserFavoriteAlbum_userId_albumId_key" ON "UserFavoriteAlbum"("userId","albumId");
CREATE INDEX "UserFavoriteAlbum_userId_idx" ON "UserFavoriteAlbum"("userId");
CREATE INDEX "UserFavoriteAlbum_albumId_idx" ON "UserFavoriteAlbum"("albumId");

CREATE TABLE "AlbumRating" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlbumRating_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AlbumRating_userId_albumId_key" ON "AlbumRating"("userId","albumId");
CREATE INDEX "AlbumRating_userId_idx" ON "AlbumRating"("userId");
CREATE INDEX "AlbumRating_albumId_idx" ON "AlbumRating"("albumId");
ALTER TABLE "AlbumRating" ADD CONSTRAINT "AlbumRating_rating_range" CHECK ("rating" >= 1 AND "rating" <= 5);

CREATE TABLE "AlbumReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlbumReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AlbumReview_userId_albumId_key" ON "AlbumReview"("userId","albumId");
CREATE INDEX "AlbumReview_userId_idx" ON "AlbumReview"("userId");
CREATE INDEX "AlbumReview_albumId_idx" ON "AlbumReview"("albumId");

CREATE TABLE "UserEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "albumId" TEXT,
    "type" "UserEventType" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserEvent_userId_createdAt_idx" ON "UserEvent"("userId","createdAt");
CREATE INDEX "UserEvent_albumId_idx" ON "UserEvent"("albumId");

-- Weekly drops
CREATE TABLE "WeeklyDrop" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "status" "WeeklyDropStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyDrop_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WeeklyDrop_userId_weekStart_key" ON "WeeklyDrop"("userId","weekStart");
CREATE INDEX "WeeklyDrop_userId_idx" ON "WeeklyDrop"("userId");
CREATE INDEX "WeeklyDrop_weekStart_idx" ON "WeeklyDrop"("weekStart");

CREATE TABLE "WeeklyDropItem" (
    "id" TEXT NOT NULL,
    "weeklyDropId" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "reason" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyDropItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WeeklyDropItem_weeklyDropId_albumId_key" ON "WeeklyDropItem"("weeklyDropId","albumId");
CREATE UNIQUE INDEX "WeeklyDropItem_weeklyDropId_rank_key" ON "WeeklyDropItem"("weeklyDropId","rank");
CREATE INDEX "WeeklyDropItem_weeklyDropId_idx" ON "WeeklyDropItem"("weeklyDropId");
CREATE INDEX "WeeklyDropItem_albumId_idx" ON "WeeklyDropItem"("albumId");

-- Foreign keys
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Album" ADD CONSTRAINT "Album_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AlbumTag" ADD CONSTRAINT "AlbumTag_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlbumTag" ADD CONSTRAINT "AlbumTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlbumEmbedding" ADD CONSTRAINT "AlbumEmbedding_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserFavoriteAlbum" ADD CONSTRAINT "UserFavoriteAlbum_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserFavoriteAlbum" ADD CONSTRAINT "UserFavoriteAlbum_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlbumRating" ADD CONSTRAINT "AlbumRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlbumRating" ADD CONSTRAINT "AlbumRating_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlbumReview" ADD CONSTRAINT "AlbumReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlbumReview" ADD CONSTRAINT "AlbumReview_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserEvent" ADD CONSTRAINT "UserEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserEvent" ADD CONSTRAINT "UserEvent_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WeeklyDrop" ADD CONSTRAINT "WeeklyDrop_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklyDropItem" ADD CONSTRAINT "WeeklyDropItem_weeklyDropId_fkey" FOREIGN KEY ("weeklyDropId") REFERENCES "WeeklyDrop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklyDropItem" ADD CONSTRAINT "WeeklyDropItem_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

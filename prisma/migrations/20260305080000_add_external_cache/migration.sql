-- Add ExternalCache table for upstream API caching

-- CreateTable
CREATE TABLE "ExternalCache" (
    "key" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "ttlSeconds" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalCache_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "ExternalCache_source_idx" ON "ExternalCache"("source");

-- CreateIndex
CREATE INDEX "ExternalCache_expiresAt_idx" ON "ExternalCache"("expiresAt");


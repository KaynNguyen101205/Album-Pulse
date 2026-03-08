-- Feedback loop: profile, suppressions, recompute runs, metrics, and not-interested reasons.

-- Enums
CREATE TYPE "NotInterestedReason" AS ENUM (
  'NOT_MY_GENRE',
  'DONT_LIKE_ARTIST',
  'ALREADY_KNOW_ALBUM',
  'TOO_SIMILAR_RECENT',
  'MOOD_MISMATCH',
  'OTHER'
);

CREATE TYPE "SuppressionTargetType" AS ENUM ('ARTIST', 'TAG', 'ALBUM');
CREATE TYPE "RecomputeRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');
CREATE TYPE "WeeklyMetricScope" AS ENUM ('USER', 'GLOBAL');

-- WeeklyDropItemFeedback extensions
ALTER TABLE "WeeklyDropItemFeedback"
  ADD COLUMN "notInterestedReason" "NotInterestedReason",
  ADD COLUMN "notInterestedOtherText" TEXT;

ALTER TABLE "WeeklyDropItemFeedback"
  ADD CONSTRAINT "WeeklyDropItemFeedback_other_reason_text_guard"
  CHECK (
    "notInterestedReason" = 'OTHER'
    OR "notInterestedOtherText" IS NULL
  );

-- UserPreferenceProfile
CREATE TABLE "UserPreferenceProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "profileVersion" INTEGER NOT NULL DEFAULT 1,
  "sourceWindowWeeks" INTEGER NOT NULL DEFAULT 12,
  "artistWeights" JSONB NOT NULL,
  "tagWeights" JSONB NOT NULL,
  "albumWeights" JSONB NOT NULL,
  "metadata" JSONB,
  "lastRecomputedAt" TIMESTAMP(3),
  "lastRecomputedWeekStart" DATE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserPreferenceProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserPreferenceProfile_userId_key"
  ON "UserPreferenceProfile"("userId");
CREATE INDEX "UserPreferenceProfile_lastRecomputedWeekStart_idx"
  ON "UserPreferenceProfile"("lastRecomputedWeekStart");

-- UserPreferenceSuppression
CREATE TABLE "UserPreferenceSuppression" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "targetType" "SuppressionTargetType" NOT NULL,
  "targetValue" TEXT NOT NULL,
  "reason" "NotInterestedReason",
  "strength" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "sourceWeekStart" DATE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserPreferenceSuppression_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserPreferenceSuppression_userId_targetType_targetValue_key"
  ON "UserPreferenceSuppression"("userId", "targetType", "targetValue");
CREATE INDEX "UserPreferenceSuppression_userId_expiresAt_idx"
  ON "UserPreferenceSuppression"("userId", "expiresAt");
CREATE INDEX "UserPreferenceSuppression_targetType_targetValue_idx"
  ON "UserPreferenceSuppression"("targetType", "targetValue");

-- UserProfileRecomputeRun
CREATE TABLE "UserProfileRecomputeRun" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "weekStart" DATE NOT NULL,
  "profileVersion" INTEGER NOT NULL DEFAULT 1,
  "status" "RecomputeRunStatus" NOT NULL,
  "processedFeedbackCount" INTEGER NOT NULL DEFAULT 0,
  "generatedSuppressions" INTEGER NOT NULL DEFAULT 0,
  "message" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserProfileRecomputeRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserProfileRecomputeRun_userId_weekStart_profileVersion_key"
  ON "UserProfileRecomputeRun"("userId", "weekStart", "profileVersion");
CREATE INDEX "UserProfileRecomputeRun_status_startedAt_idx"
  ON "UserProfileRecomputeRun"("status", "startedAt");
CREATE INDEX "UserProfileRecomputeRun_userId_weekStart_idx"
  ON "UserProfileRecomputeRun"("userId", "weekStart");

-- WeeklyDropMetric
CREATE TABLE "WeeklyDropMetric" (
  "id" TEXT NOT NULL,
  "metricKey" TEXT NOT NULL,
  "scope" "WeeklyMetricScope" NOT NULL,
  "userId" TEXT,
  "weekStart" DATE NOT NULL,
  "weeklyDropId" TEXT,
  "impressions" INTEGER NOT NULL DEFAULT 0,
  "clicks" INTEGER NOT NULL DEFAULT 0,
  "saves" INTEGER NOT NULL DEFAULT 0,
  "ratingsCount" INTEGER NOT NULL DEFAULT 0,
  "ratingsSum" INTEGER NOT NULL DEFAULT 0,
  "dislikes" INTEGER NOT NULL DEFAULT 0,
  "skips" INTEGER NOT NULL DEFAULT 0,
  "reviews" INTEGER NOT NULL DEFAULT 0,
  "notInterested" INTEGER NOT NULL DEFAULT 0,
  "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "saveRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "avgRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "dislikeRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "skipRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "reviewRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "notInterestedRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WeeklyDropMetric_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WeeklyDropMetric_metricKey_key" ON "WeeklyDropMetric"("metricKey");
CREATE INDEX "WeeklyDropMetric_scope_weekStart_idx" ON "WeeklyDropMetric"("scope", "weekStart");
CREATE INDEX "WeeklyDropMetric_userId_weekStart_idx" ON "WeeklyDropMetric"("userId", "weekStart");

-- Foreign keys
ALTER TABLE "UserPreferenceProfile"
  ADD CONSTRAINT "UserPreferenceProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserPreferenceSuppression"
  ADD CONSTRAINT "UserPreferenceSuppression_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserProfileRecomputeRun"
  ADD CONSTRAINT "UserProfileRecomputeRun_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WeeklyDropMetric"
  ADD CONSTRAINT "WeeklyDropMetric_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WeeklyDropMetric"
  ADD CONSTRAINT "WeeklyDropMetric_weeklyDropId_fkey"
  FOREIGN KEY ("weeklyDropId") REFERENCES "WeeklyDrop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

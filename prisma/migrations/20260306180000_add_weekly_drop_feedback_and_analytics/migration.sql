-- Weekly drop feedback + analytics event log

CREATE TABLE "WeeklyDropItemFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weeklyDropItemId" TEXT NOT NULL,
    "liked" BOOLEAN,
    "disliked" BOOLEAN,
    "skipped" BOOLEAN,
    "saved" BOOLEAN,
    "rating" INTEGER,
    "reviewText" TEXT,
    "alreadyListened" BOOLEAN,
    "listenedNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyDropItemFeedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WeeklyDropItemFeedback_userId_weeklyDropItemId_key"
    ON "WeeklyDropItemFeedback"("userId", "weeklyDropItemId");
CREATE INDEX "WeeklyDropItemFeedback_userId_updatedAt_idx"
    ON "WeeklyDropItemFeedback"("userId", "updatedAt");
CREATE INDEX "WeeklyDropItemFeedback_weeklyDropItemId_idx"
    ON "WeeklyDropItemFeedback"("weeklyDropItemId");

ALTER TABLE "WeeklyDropItemFeedback"
    ADD CONSTRAINT "WeeklyDropItemFeedback_rating_range"
    CHECK ("rating" IS NULL OR ("rating" >= 1 AND "rating" <= 5));

ALTER TABLE "WeeklyDropItemFeedback"
    ADD CONSTRAINT "WeeklyDropItemFeedback_reaction_exclusive"
    CHECK (
      (CASE WHEN "liked" IS TRUE THEN 1 ELSE 0 END) +
      (CASE WHEN "disliked" IS TRUE THEN 1 ELSE 0 END) +
      (CASE WHEN "skipped" IS TRUE THEN 1 ELSE 0 END)
      <= 1
    );

CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weeklyDropId" TEXT,
    "weeklyDropItemId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AnalyticsEvent_eventName_createdAt_idx"
    ON "AnalyticsEvent"("eventName", "createdAt");
CREATE INDEX "AnalyticsEvent_userId_createdAt_idx"
    ON "AnalyticsEvent"("userId", "createdAt");
CREATE INDEX "AnalyticsEvent_weeklyDropId_createdAt_idx"
    ON "AnalyticsEvent"("weeklyDropId", "createdAt");
CREATE INDEX "AnalyticsEvent_weeklyDropItemId_createdAt_idx"
    ON "AnalyticsEvent"("weeklyDropItemId", "createdAt");

ALTER TABLE "WeeklyDropItemFeedback"
    ADD CONSTRAINT "WeeklyDropItemFeedback_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklyDropItemFeedback"
    ADD CONSTRAINT "WeeklyDropItemFeedback_weeklyDropItemId_fkey"
    FOREIGN KEY ("weeklyDropItemId") REFERENCES "WeeklyDropItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AnalyticsEvent"
    ADD CONSTRAINT "AnalyticsEvent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalyticsEvent"
    ADD CONSTRAINT "AnalyticsEvent_weeklyDropId_fkey"
    FOREIGN KEY ("weeklyDropId") REFERENCES "WeeklyDrop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnalyticsEvent"
    ADD CONSTRAINT "AnalyticsEvent_weeklyDropItemId_fkey"
    FOREIGN KEY ("weeklyDropItemId") REFERENCES "WeeklyDropItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

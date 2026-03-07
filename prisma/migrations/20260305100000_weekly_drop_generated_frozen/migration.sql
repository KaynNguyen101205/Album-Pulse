-- Add generation metadata to WeeklyDrop for cron and 7-day freeze tracking.
ALTER TABLE "WeeklyDrop" ADD COLUMN IF NOT EXISTS "generatedAt" TIMESTAMP(3);
ALTER TABLE "WeeklyDrop" ADD COLUMN IF NOT EXISTS "frozenUntil" DATE;

import 'server-only';

import { randomUUID } from 'crypto';

import { prisma } from '@/lib/prisma';
import {
  FEEDBACK_LOOP_CONFIG,
  RECOMMENDATION_PROFILE_VERSION,
} from '@/lib/recommendation/config';
import { feedbackToPreferenceDeltas } from '@/lib/recommendation/feedback-weights';
import { rebuildProfileFromResults } from '@/lib/recommendation/profile-update';
import { collapseSuppressionIntents } from '@/lib/recommendation/suppression';
import type { NotInterestedReason } from '@/types/weekly-drop';
import { getCurrentWeekStartUTC } from '@/server/scheduler/weekUtils';

type FeedbackRow = {
  feedbackId: string;
  updatedAt: Date;
  liked: boolean | null;
  disliked: boolean | null;
  skipped: boolean | null;
  saved: boolean | null;
  rating: number | null;
  reviewText: string | null;
  alreadyListened: boolean | null;
  notInterestedReason: NotInterestedReason | null;
  notInterestedOtherText: string | null;
  albumId: string;
  artistName: string;
  tags: string[] | null;
};

export type RecomputeUserProfileResult = {
  ok: boolean;
  userId: string;
  weekStart: string;
  processedFeedbackCount: number;
  generatedSuppressions: number;
  error?: string;
};

function toDateOnlyString(value: Date): string {
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, '0');
  const d = String(value.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toUtcDateStart(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function subtractWeeks(date: Date, weeks: number): Date {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() - weeks * 7);
  return copy;
}

async function fetchFeedbackRows(userId: string, weekStart: Date): Promise<FeedbackRow[]> {
  const windowStart = subtractWeeks(weekStart, FEEDBACK_LOOP_CONFIG.sourceWindowWeeks);
  const rows = await prisma.$queryRawUnsafe<FeedbackRow[]>(
    `
    SELECT
      wdf."id" AS "feedbackId",
      wdf."updatedAt" AS "updatedAt",
      wdf."liked" AS "liked",
      wdf."disliked" AS "disliked",
      wdf."skipped" AS "skipped",
      wdf."saved" AS "saved",
      wdf."rating" AS "rating",
      wdf."reviewText" AS "reviewText",
      wdf."alreadyListened" AS "alreadyListened",
      wdf."notInterestedReason" AS "notInterestedReason",
      wdf."notInterestedOtherText" AS "notInterestedOtherText",
      a."id" AS "albumId",
      ar."name" AS "artistName",
      COALESCE(array_remove(array_agg(DISTINCT LOWER(t."name")), NULL), '{}') AS "tags"
    FROM "WeeklyDropItemFeedback" wdf
    JOIN "WeeklyDropItem" wdi ON wdi."id" = wdf."weeklyDropItemId"
    JOIN "WeeklyDrop" wd ON wd."id" = wdi."weeklyDropId"
    JOIN "Album" a ON a."id" = wdi."albumId"
    JOIN "Artist" ar ON ar."id" = a."artistId"
    LEFT JOIN "AlbumTag" at2 ON at2."albumId" = a."id"
    LEFT JOIN "Tag" t ON t."id" = at2."tagId"
    WHERE
      wdf."userId" = $1
      AND wd."weekStart" >= $2::date
      AND wd."weekStart" < $3::date
    GROUP BY
      wdf."id",
      wdf."updatedAt",
      wdf."liked",
      wdf."disliked",
      wdf."skipped",
      wdf."saved",
      wdf."rating",
      wdf."reviewText",
      wdf."alreadyListened",
      wdf."notInterestedReason",
      wdf."notInterestedOtherText",
      a."id",
      ar."name"
    `,
    userId,
    toDateOnlyString(windowStart),
    toDateOnlyString(weekStart)
  );
  return rows;
}

async function markRunStatus(input: {
  userId: string;
  weekStart: Date;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED';
  processedFeedbackCount?: number;
  generatedSuppressions?: number;
  message?: string | null;
  completedAt?: Date | null;
}): Promise<void> {
  await prisma.userProfileRecomputeRun.upsert({
    where: {
      userId_weekStart_profileVersion: {
        userId: input.userId,
        weekStart: input.weekStart,
        profileVersion: RECOMMENDATION_PROFILE_VERSION,
      },
    },
    create: {
      id: randomUUID(),
      userId: input.userId,
      weekStart: input.weekStart,
      profileVersion: RECOMMENDATION_PROFILE_VERSION,
      status: input.status,
      processedFeedbackCount: input.processedFeedbackCount ?? 0,
      generatedSuppressions: input.generatedSuppressions ?? 0,
      message: input.message ?? null,
      startedAt: new Date(),
      completedAt: input.completedAt ?? null,
    },
    update: {
      status: input.status,
      processedFeedbackCount: input.processedFeedbackCount ?? 0,
      generatedSuppressions: input.generatedSuppressions ?? 0,
      message: input.message ?? null,
      startedAt: input.status === 'RUNNING' ? new Date() : undefined,
      completedAt: input.completedAt ?? null,
    },
  });
}

export async function recomputeUserPreferenceProfile(
  userId: string,
  options?: { weekStart?: Date }
): Promise<RecomputeUserProfileResult> {
  const weekStart = toUtcDateStart(options?.weekStart ?? getCurrentWeekStartUTC());
  const weekStartKey = toDateOnlyString(weekStart);

  await markRunStatus({
    userId,
    weekStart,
    status: 'RUNNING',
    processedFeedbackCount: 0,
    generatedSuppressions: 0,
    message: null,
    completedAt: null,
  });

  try {
    const rows = await fetchFeedbackRows(userId, weekStart);
    const deltaResults = rows.map((row) =>
      feedbackToPreferenceDeltas(
        {
          liked: row.liked,
          disliked: row.disliked,
          skipped: row.skipped,
          saved: row.saved,
          rating: row.rating,
          reviewText: row.reviewText,
          alreadyListened: row.alreadyListened,
          notInterestedReason: row.notInterestedReason,
          notInterestedOtherText: row.notInterestedOtherText,
          feedbackUpdatedAt: row.updatedAt,
        },
        {
          albumId: row.albumId,
          artistName: row.artistName,
          tagNames: row.tags ?? [],
        },
        { now: weekStart }
      )
    );

    const profile = rebuildProfileFromResults(deltaResults);
    const suppressionRules = collapseSuppressionIntents(
      deltaResults.flatMap((result) => result.suppressions),
      { now: weekStart }
    );

    await prisma.$transaction(async (tx) => {
      await tx.userPreferenceProfile.upsert({
        where: { userId },
        create: {
          id: randomUUID(),
          userId,
          profileVersion: RECOMMENDATION_PROFILE_VERSION,
          sourceWindowWeeks: FEEDBACK_LOOP_CONFIG.sourceWindowWeeks,
          artistWeights: profile.artistWeights,
          tagWeights: profile.tagWeights,
          albumWeights: profile.albumWeights,
          metadata: {
            feedbackCount: rows.length,
            recomputedAt: new Date().toISOString(),
          },
          lastRecomputedAt: new Date(),
          lastRecomputedWeekStart: weekStart,
        },
        update: {
          profileVersion: RECOMMENDATION_PROFILE_VERSION,
          sourceWindowWeeks: FEEDBACK_LOOP_CONFIG.sourceWindowWeeks,
          artistWeights: profile.artistWeights,
          tagWeights: profile.tagWeights,
          albumWeights: profile.albumWeights,
          metadata: {
            feedbackCount: rows.length,
            recomputedAt: new Date().toISOString(),
          },
          lastRecomputedAt: new Date(),
          lastRecomputedWeekStart: weekStart,
        },
      });

      await tx.userPreferenceSuppression.deleteMany({ where: { userId } });
      if (suppressionRules.length > 0) {
        await tx.userPreferenceSuppression.createMany({
          data: suppressionRules.map((rule) => ({
            id: randomUUID(),
            userId,
            targetType: rule.targetType,
            targetValue: rule.targetValue,
            reason: rule.reason,
            strength: rule.strength,
            sourceWeekStart: weekStart,
            expiresAt: rule.expiresAt,
          })),
        });
      }

      await tx.userProfileRecomputeRun.update({
        where: {
          userId_weekStart_profileVersion: {
            userId,
            weekStart,
            profileVersion: RECOMMENDATION_PROFILE_VERSION,
          },
        },
        data: {
          status: 'SUCCESS',
          processedFeedbackCount: rows.length,
          generatedSuppressions: suppressionRules.length,
          message: null,
          completedAt: new Date(),
        },
      });
    });

    return {
      ok: true,
      userId,
      weekStart: weekStartKey,
      processedFeedbackCount: rows.length,
      generatedSuppressions: suppressionRules.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markRunStatus({
      userId,
      weekStart,
      status: 'FAILED',
      message,
      completedAt: new Date(),
    });
    return {
      ok: false,
      userId,
      weekStart: weekStartKey,
      processedFeedbackCount: 0,
      generatedSuppressions: 0,
      error: message,
    };
  }
}

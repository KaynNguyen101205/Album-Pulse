import 'server-only';

import { randomUUID } from 'crypto';

import { prisma } from '@/lib/prisma';
import {
  compareCurrentVsPrevious,
  toWeeklyMetricRow,
} from '@/lib/recommendation/evaluation';
import type { WeeklyMetricRow } from '@/lib/recommendation/types';
import type { WeeklyDropMetricsSummary } from '@/types/weekly-drop';
import { getCurrentWeekStartUTC } from '@/server/scheduler/weekUtils';

type UserWeekCounts = {
  weekStart: string;
  weeklyDropId: string | null;
  impressions: number;
  clicks: number;
  saves: number;
  ratingsCount: number;
  ratingsSum: number;
  dislikes: number;
  skips: number;
  reviews: number;
  notInterested: number;
};

function toDateOnlyString(value: Date): string {
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, '0');
  const d = String(value.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function weekShift(weekStart: string, weeks: number): string {
  const date = parseDateOnly(weekStart);
  date.setUTCDate(date.getUTCDate() + weeks * 7);
  return toDateOnlyString(date);
}

function metricKey(scope: 'USER' | 'GLOBAL', weekStart: string, userId?: string | null): string {
  return scope === 'GLOBAL' ? `GLOBAL:${weekStart}` : `USER:${userId ?? 'unknown'}:${weekStart}`;
}

async function fetchUserCountsForWeek(userId: string, weekStart: string): Promise<UserWeekCounts> {
  const drop = await prisma.weeklyDrop.findUnique({
    where: {
      userId_weekStart: {
        userId,
        weekStart: parseDateOnly(weekStart),
      },
    },
    select: { id: true },
  });

  if (!drop) {
    return {
      weekStart,
      weeklyDropId: null,
      impressions: 0,
      clicks: 0,
      saves: 0,
      ratingsCount: 0,
      ratingsSum: 0,
      dislikes: 0,
      skips: 0,
      reviews: 0,
      notInterested: 0,
    };
  }

  const [impressionRows, clickRows, feedbackRows] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ value: number }>>(
      `SELECT COUNT(*)::int AS "value" FROM "WeeklyDropItem" WHERE "weeklyDropId" = $1`,
      drop.id
    ),
    prisma.$queryRawUnsafe<Array<{ value: number }>>(
      `SELECT COUNT(*)::int AS "value"
       FROM "AnalyticsEvent"
       WHERE "userId" = $1
         AND "weeklyDropId" = $2
         AND "eventName" = 'weekly_drop_album_card_interact'`,
      userId,
      drop.id
    ),
    prisma.$queryRawUnsafe<
      Array<{
        saves: number;
        ratingsCount: number;
        ratingsSum: number;
        dislikes: number;
        skips: number;
        reviews: number;
        notInterested: number;
      }>
    >(
      `SELECT
        COALESCE(SUM(CASE WHEN wdf."saved" IS TRUE THEN 1 ELSE 0 END), 0)::int AS "saves",
        COALESCE(SUM(CASE WHEN wdf."rating" IS NOT NULL THEN 1 ELSE 0 END), 0)::int AS "ratingsCount",
        COALESCE(SUM(CASE WHEN wdf."rating" IS NOT NULL THEN wdf."rating" ELSE 0 END), 0)::int AS "ratingsSum",
        COALESCE(SUM(CASE WHEN wdf."disliked" IS TRUE THEN 1 ELSE 0 END), 0)::int AS "dislikes",
        COALESCE(SUM(CASE WHEN wdf."skipped" IS TRUE THEN 1 ELSE 0 END), 0)::int AS "skips",
        COALESCE(SUM(CASE WHEN wdf."reviewText" IS NOT NULL AND LENGTH(TRIM(wdf."reviewText")) > 0 THEN 1 ELSE 0 END), 0)::int AS "reviews",
        COALESCE(SUM(CASE WHEN wdf."notInterestedReason" IS NOT NULL THEN 1 ELSE 0 END), 0)::int AS "notInterested"
       FROM "WeeklyDropItemFeedback" wdf
       JOIN "WeeklyDropItem" wdi ON wdi."id" = wdf."weeklyDropItemId"
       WHERE wdf."userId" = $1
         AND wdi."weeklyDropId" = $2`,
      userId,
      drop.id
    ),
  ]);

  const aggregate = feedbackRows[0] ?? {
    saves: 0,
    ratingsCount: 0,
    ratingsSum: 0,
    dislikes: 0,
    skips: 0,
    reviews: 0,
    notInterested: 0,
  };

  return {
    weekStart,
    weeklyDropId: drop.id,
    impressions: Number(impressionRows[0]?.value ?? 0),
    clicks: Number(clickRows[0]?.value ?? 0),
    saves: Number(aggregate.saves ?? 0),
    ratingsCount: Number(aggregate.ratingsCount ?? 0),
    ratingsSum: Number(aggregate.ratingsSum ?? 0),
    dislikes: Number(aggregate.dislikes ?? 0),
    skips: Number(aggregate.skips ?? 0),
    reviews: Number(aggregate.reviews ?? 0),
    notInterested: Number(aggregate.notInterested ?? 0),
  };
}

async function upsertMetricRow(row: WeeklyMetricRow & { weeklyDropId: string | null }): Promise<void> {
  const key = metricKey(row.scope, row.weekStart, row.userId);
  await prisma.weeklyDropMetric.upsert({
    where: { metricKey: key },
    create: {
      id: randomUUID(),
      metricKey: key,
      scope: row.scope,
      userId: row.userId,
      weekStart: parseDateOnly(row.weekStart),
      weeklyDropId: row.weeklyDropId,
      impressions: row.impressions,
      clicks: row.clicks,
      saves: row.saves,
      ratingsCount: row.ratingsCount,
      ratingsSum: row.ratingsSum,
      dislikes: row.dislikes,
      skips: row.skips,
      reviews: row.reviews,
      notInterested: row.notInterested,
      ctr: row.ctr,
      saveRate: row.saveRate,
      avgRating: row.avgRating,
      dislikeRate: row.dislikeRate,
      skipRate: row.skipRate,
      reviewRate: row.reviewRate,
      notInterestedRate: row.notInterestedRate,
    },
    update: {
      weeklyDropId: row.weeklyDropId,
      impressions: row.impressions,
      clicks: row.clicks,
      saves: row.saves,
      ratingsCount: row.ratingsCount,
      ratingsSum: row.ratingsSum,
      dislikes: row.dislikes,
      skips: row.skips,
      reviews: row.reviews,
      notInterested: row.notInterested,
      ctr: row.ctr,
      saveRate: row.saveRate,
      avgRating: row.avgRating,
      dislikeRate: row.dislikeRate,
      skipRate: row.skipRate,
      reviewRate: row.reviewRate,
      notInterestedRate: row.notInterestedRate,
    },
  });
}

async function recomputeGlobalMetricForWeek(weekStart: string): Promise<void> {
  const userRows = await prisma.weeklyDropMetric.findMany({
    where: { scope: 'USER', weekStart: parseDateOnly(weekStart) },
    select: {
      impressions: true,
      clicks: true,
      saves: true,
      ratingsCount: true,
      ratingsSum: true,
      dislikes: true,
      skips: true,
      reviews: true,
      notInterested: true,
    },
  });

  const totals = userRows.reduce(
    (acc, row) => {
      acc.impressions += row.impressions;
      acc.clicks += row.clicks;
      acc.saves += row.saves;
      acc.ratingsCount += row.ratingsCount;
      acc.ratingsSum += row.ratingsSum;
      acc.dislikes += row.dislikes;
      acc.skips += row.skips;
      acc.reviews += row.reviews;
      acc.notInterested += row.notInterested;
      return acc;
    },
    {
      impressions: 0,
      clicks: 0,
      saves: 0,
      ratingsCount: 0,
      ratingsSum: 0,
      dislikes: 0,
      skips: 0,
      reviews: 0,
      notInterested: 0,
    }
  );

  const metric = toWeeklyMetricRow({
    weekStart,
    scope: 'GLOBAL',
    userId: null,
    ...totals,
  });
  await upsertMetricRow({ ...metric, weeklyDropId: null });
}

export async function recomputeWeeklyMetricsForWeek(
  weekStart: Date | string,
  userIds: string[]
): Promise<void> {
  const normalizedWeekStart =
    typeof weekStart === 'string' ? weekStart : toDateOnlyString(weekStart);

  for (const userId of userIds) {
    const counts = await fetchUserCountsForWeek(userId, normalizedWeekStart);
    const metric = toWeeklyMetricRow({
      weekStart: counts.weekStart,
      scope: 'USER',
      userId,
      impressions: counts.impressions,
      clicks: counts.clicks,
      saves: counts.saves,
      ratingsCount: counts.ratingsCount,
      ratingsSum: counts.ratingsSum,
      dislikes: counts.dislikes,
      skips: counts.skips,
      reviews: counts.reviews,
      notInterested: counts.notInterested,
    });
    await upsertMetricRow({ ...metric, weeklyDropId: counts.weeklyDropId });
  }

  await recomputeGlobalMetricForWeek(normalizedWeekStart);
}

function mapMetricRow(row: {
  weekStart: Date;
  scope: 'USER' | 'GLOBAL';
  userId: string | null;
  impressions: number;
  clicks: number;
  saves: number;
  ratingsCount: number;
  ratingsSum: number;
  dislikes: number;
  skips: number;
  reviews: number;
  notInterested: number;
  ctr: number;
  saveRate: number;
  avgRating: number;
  dislikeRate: number;
  skipRate: number;
  reviewRate: number;
  notInterestedRate: number;
}): WeeklyMetricRow {
  return {
    weekStart: toDateOnlyString(row.weekStart),
    scope: row.scope,
    userId: row.userId,
    impressions: row.impressions,
    clicks: row.clicks,
    saves: row.saves,
    ratingsCount: row.ratingsCount,
    ratingsSum: row.ratingsSum,
    dislikes: row.dislikes,
    skips: row.skips,
    reviews: row.reviews,
    notInterested: row.notInterested,
    ctr: row.ctr,
    saveRate: row.saveRate,
    avgRating: row.avgRating,
    dislikeRate: row.dislikeRate,
    skipRate: row.skipRate,
    reviewRate: row.reviewRate,
    notInterestedRate: row.notInterestedRate,
  };
}

export async function getWeeklyDropMetricsSummary(input: {
  userId: string;
  weeks: number;
}): Promise<WeeklyDropMetricsSummary> {
  const currentWeek = toDateOnlyString(getCurrentWeekStartUTC());
  const fromWeek = weekShift(currentWeek, -(input.weeks - 1));

  const [userRows, globalRows] = await Promise.all([
    prisma.weeklyDropMetric.findMany({
      where: {
        scope: 'USER',
        userId: input.userId,
        weekStart: {
          gte: parseDateOnly(fromWeek),
          lte: parseDateOnly(currentWeek),
        },
      },
      orderBy: { weekStart: 'desc' },
    }),
    prisma.weeklyDropMetric.findMany({
      where: {
        scope: 'GLOBAL',
        weekStart: {
          gte: parseDateOnly(fromWeek),
          lte: parseDateOnly(currentWeek),
        },
      },
      orderBy: { weekStart: 'desc' },
    }),
  ]);

  const mappedUser = userRows.map(mapMetricRow);
  const mappedGlobal = globalRows.map(mapMetricRow);

  return {
    userMetrics: mappedUser,
    globalMetrics: mappedGlobal,
    comparisons: {
      user: compareCurrentVsPrevious(mappedUser),
      global: compareCurrentVsPrevious(mappedGlobal),
    },
  };
}

import type { WeeklyMetricRow } from './types';

type MetricCountsInput = {
  weekStart: string;
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
};

function rate(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }
  return Number((numerator / denominator).toFixed(6));
}

export function toWeeklyMetricRow(input: MetricCountsInput): WeeklyMetricRow {
  const avgRating = input.ratingsCount > 0 ? input.ratingsSum / input.ratingsCount : 0;
  return {
    weekStart: input.weekStart,
    scope: input.scope,
    userId: input.userId,
    impressions: input.impressions,
    clicks: input.clicks,
    saves: input.saves,
    ratingsCount: input.ratingsCount,
    ratingsSum: input.ratingsSum,
    dislikes: input.dislikes,
    skips: input.skips,
    reviews: input.reviews,
    notInterested: input.notInterested,
    ctr: rate(input.clicks, input.impressions),
    saveRate: rate(input.saves, input.impressions),
    avgRating: Number(avgRating.toFixed(6)),
    dislikeRate: rate(input.dislikes, input.impressions),
    skipRate: rate(input.skips, input.impressions),
    reviewRate: rate(input.reviews, input.impressions),
    notInterestedRate: rate(input.notInterested, input.impressions),
  };
}

type ComparableMetric = Pick<
  WeeklyMetricRow,
  | 'ctr'
  | 'saveRate'
  | 'avgRating'
  | 'dislikeRate'
  | 'skipRate'
  | 'reviewRate'
  | 'notInterestedRate'
>;

function averageMetrics(rows: WeeklyMetricRow[]): ComparableMetric {
  if (rows.length === 0) {
    return {
      ctr: 0,
      saveRate: 0,
      avgRating: 0,
      dislikeRate: 0,
      skipRate: 0,
      reviewRate: 0,
      notInterestedRate: 0,
    };
  }

  const sum = rows.reduce(
    (acc, row) => {
      acc.ctr += row.ctr;
      acc.saveRate += row.saveRate;
      acc.avgRating += row.avgRating;
      acc.dislikeRate += row.dislikeRate;
      acc.skipRate += row.skipRate;
      acc.reviewRate += row.reviewRate;
      acc.notInterestedRate += row.notInterestedRate;
      return acc;
    },
    {
      ctr: 0,
      saveRate: 0,
      avgRating: 0,
      dislikeRate: 0,
      skipRate: 0,
      reviewRate: 0,
      notInterestedRate: 0,
    }
  );

  return {
    ctr: Number((sum.ctr / rows.length).toFixed(6)),
    saveRate: Number((sum.saveRate / rows.length).toFixed(6)),
    avgRating: Number((sum.avgRating / rows.length).toFixed(6)),
    dislikeRate: Number((sum.dislikeRate / rows.length).toFixed(6)),
    skipRate: Number((sum.skipRate / rows.length).toFixed(6)),
    reviewRate: Number((sum.reviewRate / rows.length).toFixed(6)),
    notInterestedRate: Number((sum.notInterestedRate / rows.length).toFixed(6)),
  };
}

export function compareCurrentVsPrevious(rows: WeeklyMetricRow[]): Record<string, number> {
  if (rows.length === 0) return {};
  const sorted = [...rows].sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  const current = sorted[0];
  const previous = averageMetrics(sorted.slice(1));

  return {
    ctrDelta: Number((current.ctr - previous.ctr).toFixed(6)),
    saveRateDelta: Number((current.saveRate - previous.saveRate).toFixed(6)),
    avgRatingDelta: Number((current.avgRating - previous.avgRating).toFixed(6)),
    dislikeRateDelta: Number((current.dislikeRate - previous.dislikeRate).toFixed(6)),
    skipRateDelta: Number((current.skipRate - previous.skipRate).toFixed(6)),
    reviewRateDelta: Number((current.reviewRate - previous.reviewRate).toFixed(6)),
    notInterestedRateDelta: Number(
      (current.notInterestedRate - previous.notInterestedRate).toFixed(6)
    ),
  };
}

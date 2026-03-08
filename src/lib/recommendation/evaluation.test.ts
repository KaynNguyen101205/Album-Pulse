import { describe, expect, it } from 'vitest';

import { compareCurrentVsPrevious, toWeeklyMetricRow } from './evaluation';

describe('evaluation helpers', () => {
  it('computes weekly rates', () => {
    const row = toWeeklyMetricRow({
      weekStart: '2026-03-02',
      scope: 'USER',
      userId: 'u1',
      impressions: 5,
      clicks: 2,
      saves: 1,
      ratingsCount: 2,
      ratingsSum: 8,
      dislikes: 1,
      skips: 1,
      reviews: 1,
      notInterested: 1,
    });
    expect(row.ctr).toBeCloseTo(0.4);
    expect(row.avgRating).toBeCloseTo(4);
  });

  it('compares current week against previous average', () => {
    const comparison = compareCurrentVsPrevious([
      toWeeklyMetricRow({
        weekStart: '2026-03-09',
        scope: 'USER',
        userId: 'u1',
        impressions: 5,
        clicks: 3,
        saves: 2,
        ratingsCount: 1,
        ratingsSum: 5,
        dislikes: 0,
        skips: 1,
        reviews: 1,
        notInterested: 0,
      }),
      toWeeklyMetricRow({
        weekStart: '2026-03-02',
        scope: 'USER',
        userId: 'u1',
        impressions: 5,
        clicks: 1,
        saves: 0,
        ratingsCount: 1,
        ratingsSum: 3,
        dislikes: 2,
        skips: 2,
        reviews: 0,
        notInterested: 1,
      }),
    ]);
    expect(comparison.ctrDelta).toBeGreaterThan(0);
  });
});

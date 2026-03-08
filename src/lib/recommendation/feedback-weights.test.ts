import { describe, expect, it } from 'vitest';

import {
  feedbackSignalScore,
  feedbackToPreferenceDeltas,
} from './feedback-weights';

describe('feedbackSignalScore', () => {
  it('scores positive feedback above neutral', () => {
    const score = feedbackSignalScore({
      liked: true,
      saved: true,
      rating: 5,
      reviewText: 'Loved it',
    });
    expect(score).toBeGreaterThan(0);
  });

  it('scores strong negative feedback below neutral', () => {
    const score = feedbackSignalScore({
      disliked: true,
      skipped: true,
      rating: 1,
      notInterestedReason: 'DONT_LIKE_ARTIST',
    });
    expect(score).toBeLessThan(0);
  });
});

describe('feedbackToPreferenceDeltas', () => {
  it('creates positive affinity deltas', () => {
    const result = feedbackToPreferenceDeltas(
      { liked: true, saved: true, rating: 5 },
      { albumId: 'album-1', artistId: 'artist-1', tagNames: ['rock'] }
    );

    expect(result.score).toBeGreaterThan(0);
    expect(result.deltas.artist['artist-1']).toBeGreaterThan(0);
    expect(result.deltas.tag.rock).toBeGreaterThan(0);
    expect(result.suppressions).toHaveLength(0);
  });

  it('creates suppressions for not-interested reason', () => {
    const result = feedbackToPreferenceDeltas(
      {
        disliked: true,
        notInterestedReason: 'NOT_MY_GENRE',
      },
      { albumId: 'album-1', artistId: 'artist-1', tagNames: ['electronic'] }
    );

    expect(result.suppressions.some((s) => s.targetType === 'TAG')).toBe(true);
    expect(result.suppressions.some((s) => s.targetType === 'ALBUM')).toBe(true);
  });
});

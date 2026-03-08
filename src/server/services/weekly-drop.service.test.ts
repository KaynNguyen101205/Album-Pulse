import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/session', () => ({
  getSessionUserId: vi.fn().mockResolvedValue('test-user'),
}));

import {
  FeedbackValidationError,
  getLocalIsoWeekStartDate,
  mergeFeedbackState,
} from '@/server/services/weekly-drop.service';
import type { WeeklyDropFeedback } from '@/types/weekly-drop';

function emptyFeedback(): WeeklyDropFeedback {
  return {
    liked: null,
    disliked: null,
    skipped: null,
    saved: null,
    rating: null,
    reviewText: null,
    alreadyListened: null,
    listenedNotes: null,
    notInterestedReason: null,
    notInterestedOtherText: null,
    updatedAt: null,
  };
}

describe('getLocalIsoWeekStartDate', () => {
  it('returns monday start for a sunday date', () => {
    const start = getLocalIsoWeekStartDate(new Date('2026-03-08T12:00:00'));
    expect(start.toISOString().startsWith('2026-03-02')).toBe(true);
  });
});

describe('mergeFeedbackState', () => {
  it('validates rating bounds', () => {
    expect(() => mergeFeedbackState(emptyFeedback(), { rating: 6 })).toThrow(
      FeedbackValidationError
    );
  });

  it('applies partial patch and clears conflicting reaction', () => {
    const current = {
      ...emptyFeedback(),
      disliked: true,
      skipped: true,
    };
    const { next } = mergeFeedbackState(current, { liked: true, reviewText: '  Nice  ' });

    expect(next.liked).toBe(true);
    expect(next.disliked).toBe(false);
    expect(next.skipped).toBe(false);
    expect(next.reviewText).toBe('Nice');
  });

  it('clears notInterestedOtherText when reason is not OTHER', () => {
    const current = {
      ...emptyFeedback(),
      notInterestedReason: 'OTHER' as const,
      notInterestedOtherText: 'Not my mood',
    };
    const { next } = mergeFeedbackState(current, {
      notInterestedReason: 'NOT_MY_GENRE',
    });
    expect(next.notInterestedReason).toBe('NOT_MY_GENRE');
    expect(next.notInterestedOtherText).toBeNull();
  });
});

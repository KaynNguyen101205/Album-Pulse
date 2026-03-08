import { describe, expect, it } from 'vitest';

import { applyFeedbackPatchState } from '@/lib/weekly-drop/feedback-state';
import type { WeeklyDropFeedback } from '@/types/weekly-drop';

function baseFeedback(): WeeklyDropFeedback {
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

describe('applyFeedbackPatchState', () => {
  it('enforces mutual exclusivity when like is set', () => {
    const current = {
      ...baseFeedback(),
      disliked: true,
      skipped: true,
    };

    const { next } = applyFeedbackPatchState(current, { liked: true });

    expect(next.liked).toBe(true);
    expect(next.disliked).toBe(false);
    expect(next.skipped).toBe(false);
  });

  it('supports partial patch updates', () => {
    const current = baseFeedback();
    const { next } = applyFeedbackPatchState(current, {
      rating: 4,
      reviewText: 'Great recommendation',
    });

    expect(next.rating).toBe(4);
    expect(next.reviewText).toBe('Great recommendation');
    expect(next.saved).toBeNull();
  });

  it('detects no-op patches', () => {
    const current = {
      ...baseFeedback(),
      saved: true,
    };

    const { changed } = applyFeedbackPatchState(current, { saved: true });
    expect(changed).toBe(false);
  });

  it('keeps OTHER text only for OTHER reason', () => {
    const current = baseFeedback();
    const { next } = applyFeedbackPatchState(current, {
      notInterestedReason: 'OTHER',
      notInterestedOtherText: 'Not my vibe this week',
    });
    expect(next.notInterestedReason).toBe('OTHER');
    expect(next.notInterestedOtherText).toBe('Not my vibe this week');

    const downgraded = applyFeedbackPatchState(next, {
      notInterestedReason: 'NOT_MY_GENRE',
    }).next;
    expect(downgraded.notInterestedOtherText).toBeNull();
  });
});

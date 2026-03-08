import type { WeeklyDropFeedback, WeeklyDropFeedbackPatch } from '@/types/weekly-drop';

function normalizeString(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function enforceReactionExclusivity(
  next: WeeklyDropFeedback,
  patch: WeeklyDropFeedbackPatch
): WeeklyDropFeedback {
  const output = { ...next };
  if (patch.liked === true) {
    output.disliked = false;
    output.skipped = false;
  } else if (patch.disliked === true) {
    output.liked = false;
    output.skipped = false;
  } else if (patch.skipped === true) {
    output.liked = false;
    output.disliked = false;
  }
  return output;
}

export function applyFeedbackPatchState(
  current: WeeklyDropFeedback,
  patch: WeeklyDropFeedbackPatch
): { next: WeeklyDropFeedback; changed: boolean } {
  const normalizedReason = patch.notInterestedReason ?? null;
  const normalizedOtherText = normalizeString(patch.notInterestedOtherText) ?? null;

  const next: WeeklyDropFeedback = {
    ...current,
    ...(patch.liked !== undefined ? { liked: patch.liked } : {}),
    ...(patch.disliked !== undefined ? { disliked: patch.disliked } : {}),
    ...(patch.skipped !== undefined ? { skipped: patch.skipped } : {}),
    ...(patch.saved !== undefined ? { saved: patch.saved } : {}),
    ...(patch.rating !== undefined ? { rating: patch.rating } : {}),
    ...(patch.alreadyListened !== undefined ? { alreadyListened: patch.alreadyListened } : {}),
    ...(patch.reviewText !== undefined ? { reviewText: normalizeString(patch.reviewText) ?? null } : {}),
    ...(patch.listenedNotes !== undefined
      ? { listenedNotes: normalizeString(patch.listenedNotes) ?? null }
      : {}),
    ...(patch.notInterestedReason !== undefined
      ? { notInterestedReason: normalizedReason }
      : {}),
    ...(patch.notInterestedOtherText !== undefined
      ? { notInterestedOtherText: normalizedOtherText }
      : {}),
  };

  const exclusive = enforceReactionExclusivity(next, patch);
  if (exclusive.alreadyListened === false) {
    exclusive.listenedNotes = null;
  }
  if (exclusive.notInterestedReason !== 'OTHER') {
    exclusive.notInterestedOtherText = null;
  }

  const changed =
    exclusive.liked !== current.liked ||
    exclusive.disliked !== current.disliked ||
    exclusive.skipped !== current.skipped ||
    exclusive.saved !== current.saved ||
    exclusive.rating !== current.rating ||
    exclusive.reviewText !== current.reviewText ||
    exclusive.alreadyListened !== current.alreadyListened ||
    exclusive.listenedNotes !== current.listenedNotes ||
    exclusive.notInterestedReason !== current.notInterestedReason ||
    exclusive.notInterestedOtherText !== current.notInterestedOtherText;

  return { next: exclusive, changed };
}

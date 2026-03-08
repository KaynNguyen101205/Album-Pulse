import { FEEDBACK_LOOP_CONFIG } from './config';
import type {
  AlbumSignalContext,
  FeedbackSignalInput,
  PreferenceDeltaResult,
  ProfileDeltas,
  SuppressionIntent,
  WeightedMap,
} from './types';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeToken(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function addToMap(map: WeightedMap, key: string, value: number): void {
  if (!key || !Number.isFinite(value) || value === 0) return;
  map[key] = (map[key] ?? 0) + value;
}

function ageWeeks(feedbackUpdatedAt: Date | string | null | undefined, now: Date): number {
  if (!feedbackUpdatedAt) return 0;
  const date =
    feedbackUpdatedAt instanceof Date
      ? feedbackUpdatedAt
      : new Date(feedbackUpdatedAt);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 7));
}

export function feedbackSignalScore(
  feedback: FeedbackSignalInput
): number {
  let score = 0;
  const weights = FEEDBACK_LOOP_CONFIG.signalWeights;

  if (feedback.liked === true) score += weights.like;
  if (feedback.disliked === true) score += weights.dislike;
  if (feedback.saved === true) score += weights.save;
  if (feedback.skipped === true) score += weights.skip;
  if ((feedback.reviewText ?? '').trim()) score += weights.reviewPresent;
  if (feedback.alreadyListened === true) score += weights.alreadyListened;

  if (typeof feedback.rating === 'number' && Number.isFinite(feedback.rating)) {
    const rating = clamp(Math.round(feedback.rating), 1, 5) as 1 | 2 | 3 | 4 | 5;
    score += FEEDBACK_LOOP_CONFIG.ratingWeights[rating];
  }

  if (feedback.notInterestedReason) {
    const multiplier =
      FEEDBACK_LOOP_CONFIG.notInterestedMultipliers[feedback.notInterestedReason];
    score += weights.notInterestedBasePenalty * multiplier;
    if (
      feedback.notInterestedReason === 'OTHER' &&
      (feedback.notInterestedOtherText ?? '').trim()
    ) {
      score += weights.otherReasonTextBonusPenalty;
    }
  }

  return clamp(
    score,
    FEEDBACK_LOOP_CONFIG.scoreClamping.min,
    FEEDBACK_LOOP_CONFIG.scoreClamping.max
  );
}

function createSuppression(
  targetType: SuppressionIntent['targetType'],
  targetValue: string,
  strength: number,
  reason: SuppressionIntent['reason'],
  weeks: number
): SuppressionIntent | null {
  const normalized = normalizeToken(targetValue);
  if (!normalized || weeks <= 0 || strength <= 0) return null;
  return {
    targetType,
    targetValue: normalized,
    strength,
    reason,
    weeks,
  };
}

function baseSuppressionWeeks(targetType: SuppressionIntent['targetType']): number {
  if (targetType === 'ARTIST') return FEEDBACK_LOOP_CONFIG.artistSuppressionWeeks;
  if (targetType === 'TAG') return FEEDBACK_LOOP_CONFIG.tagSuppressionWeeks;
  return FEEDBACK_LOOP_CONFIG.albumCooldownWeeks;
}

function suppressionFromReason(
  reason: NonNullable<FeedbackSignalInput['notInterestedReason']>,
  context: AlbumSignalContext,
  strength: number
): SuppressionIntent[] {
  const durations = FEEDBACK_LOOP_CONFIG.reasonSuppressionWeeks[reason];
  const out: SuppressionIntent[] = [];
  const artistKey = normalizeToken(context.artistId ?? context.artistName);

  if (durations.artist > 0 && artistKey) {
    const s = createSuppression('ARTIST', artistKey, strength * 1.15, reason, durations.artist);
    if (s) out.push(s);
  }

  if (durations.tag > 0) {
    for (const tag of context.tagNames) {
      const s = createSuppression('TAG', tag, strength, reason, durations.tag);
      if (s) out.push(s);
    }
  }

  if (durations.album > 0) {
    const s = createSuppression('ALBUM', context.albumId, strength * 1.1, reason, durations.album);
    if (s) out.push(s);
  }

  return out;
}

export function feedbackToPreferenceDeltas(
  feedback: FeedbackSignalInput,
  context: AlbumSignalContext,
  options?: { now?: Date }
): PreferenceDeltaResult {
  const now = options?.now ?? new Date();
  const rawScore = feedbackSignalScore(feedback);
  const elapsedWeeks = ageWeeks(feedback.feedbackUpdatedAt, now);
  const decay = Math.max(
    FEEDBACK_LOOP_CONFIG.minimumDecayFactor,
    Math.pow(FEEDBACK_LOOP_CONFIG.scoreDecayPerWeek, elapsedWeeks)
  );
  const score = rawScore * decay;

  const deltas: ProfileDeltas = {
    artist: {},
    tag: {},
    album: {},
  };

  const artistKey = normalizeToken(context.artistId ?? context.artistName);
  if (artistKey) {
    addToMap(
      deltas.artist,
      artistKey,
      score * FEEDBACK_LOOP_CONFIG.deltaMultipliers.artist
    );
  }

  addToMap(
    deltas.album,
    normalizeToken(context.albumId),
    score * FEEDBACK_LOOP_CONFIG.deltaMultipliers.album
  );

  for (const tag of context.tagNames) {
    addToMap(
      deltas.tag,
      normalizeToken(tag),
      score * FEEDBACK_LOOP_CONFIG.deltaMultipliers.tag
    );
  }

  const suppressions: SuppressionIntent[] = [];
  const suppressionStrength = Math.max(0.2, Math.abs(score));

  if (feedback.notInterestedReason) {
    suppressions.push(
      ...suppressionFromReason(
        feedback.notInterestedReason,
        context,
        suppressionStrength
      )
    );
  } else {
    if (feedback.disliked === true || score <= -1.4) {
      if (artistKey) {
        const s = createSuppression(
          'ARTIST',
          artistKey,
          suppressionStrength,
          null,
          baseSuppressionWeeks('ARTIST')
        );
        if (s) suppressions.push(s);
      }
      for (const tag of context.tagNames) {
        const s = createSuppression(
          'TAG',
          tag,
          suppressionStrength * 0.9,
          null,
          baseSuppressionWeeks('TAG')
        );
        if (s) suppressions.push(s);
      }
    }
  }

  if (feedback.disliked === true || feedback.skipped === true || score <= -1.2) {
    const s = createSuppression(
      'ALBUM',
      context.albumId,
      suppressionStrength,
      feedback.notInterestedReason ?? null,
      FEEDBACK_LOOP_CONFIG.albumCooldownWeeks
    );
    if (s) suppressions.push(s);
  }

  return {
    score,
    deltas,
    suppressions,
  };
}

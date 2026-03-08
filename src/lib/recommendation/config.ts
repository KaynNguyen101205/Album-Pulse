import type { NotInterestedReason } from '@/types/weekly-drop';

export const RECOMMENDATION_PROFILE_VERSION = 1;

export const FEEDBACK_LOOP_CONFIG = {
  sourceWindowWeeks: 12,
  albumCooldownWeeks: 8,
  artistSuppressionWeeks: 6,
  tagSuppressionWeeks: 4,
  artistRepeatWindowWeeks: 6,
  artistRepeatCapInWindow: 2,
  dominantTagPenaltyThreshold: 3,
  dominantArtistPenaltyThreshold: 2,
  maxStoredArtistWeights: 200,
  maxStoredTagWeights: 200,
  maxStoredAlbumWeights: 200,
  scoreDecayPerWeek: 0.94,
  minimumDecayFactor: 0.55,
  scoreClamping: {
    min: -6,
    max: 6,
  },
  deltaMultipliers: {
    artist: 1,
    tag: 0.72,
    album: 1.15,
  },
  signalWeights: {
    like: 2.4,
    dislike: -2.8,
    save: 2,
    skip: -1.3,
    reviewPresent: 0.7,
    alreadyListened: 0.35,
    notInterestedBasePenalty: -1.8,
    otherReasonTextBonusPenalty: -0.35,
  },
  ratingWeights: {
    1: -3,
    2: -1.9,
    3: 0.2,
    4: 1.35,
    5: 2.2,
  } as Record<1 | 2 | 3 | 4 | 5, number>,
  notInterestedMultipliers: {
    NOT_MY_GENRE: 1.3,
    DONT_LIKE_ARTIST: 1.5,
    ALREADY_KNOW_ALBUM: 1.1,
    TOO_SIMILAR_RECENT: 1.2,
    MOOD_MISMATCH: 1.05,
    OTHER: 1.15,
  } as Record<NotInterestedReason, number>,
  reasonSuppressionWeeks: {
    NOT_MY_GENRE: { artist: 0, tag: 6, album: 2 },
    DONT_LIKE_ARTIST: { artist: 8, tag: 2, album: 2 },
    ALREADY_KNOW_ALBUM: { artist: 0, tag: 0, album: 8 },
    TOO_SIMILAR_RECENT: { artist: 3, tag: 5, album: 4 },
    MOOD_MISMATCH: { artist: 2, tag: 3, album: 2 },
    OTHER: { artist: 4, tag: 4, album: 4 },
  } as Record<
    NotInterestedReason,
    { artist: number; tag: number; album: number }
  >,
} as const;

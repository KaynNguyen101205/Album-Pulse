import type { NotInterestedReason } from '@/types/weekly-drop';

export type WeightedMap = Record<string, number>;

export type ProfileDeltas = {
  artist: WeightedMap;
  tag: WeightedMap;
  album: WeightedMap;
};

export type SuppressionIntent = {
  targetType: 'ARTIST' | 'TAG' | 'ALBUM';
  targetValue: string;
  strength: number;
  reason: NotInterestedReason | null;
  weeks: number;
};

export type FeedbackSignalInput = {
  liked?: boolean | null;
  disliked?: boolean | null;
  saved?: boolean | null;
  skipped?: boolean | null;
  rating?: number | null;
  reviewText?: string | null;
  alreadyListened?: boolean | null;
  notInterestedReason?: NotInterestedReason | null;
  notInterestedOtherText?: string | null;
  feedbackUpdatedAt?: Date | string | null;
};

export type AlbumSignalContext = {
  albumId: string;
  artistId?: string | null;
  artistName?: string | null;
  tagNames: string[];
};

export type PreferenceDeltaResult = {
  score: number;
  deltas: ProfileDeltas;
  suppressions: SuppressionIntent[];
};

export type UserPreferenceProfileState = {
  artistWeights: WeightedMap;
  tagWeights: WeightedMap;
  albumWeights: WeightedMap;
  profileVersion: number;
  sourceWindowWeeks: number;
};

export type ActiveSuppressionRule = {
  targetType: 'ARTIST' | 'TAG' | 'ALBUM';
  targetValue: string;
  strength: number;
  reason: NotInterestedReason | null;
  expiresAt: Date;
};

export type WeeklyMetricRow = {
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
  ctr: number;
  saveRate: number;
  avgRating: number;
  dislikeRate: number;
  skipRate: number;
  reviewRate: number;
  notInterestedRate: number;
};

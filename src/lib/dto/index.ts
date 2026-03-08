/**
 * Response DTOs for API contracts.
 * Keep fields stable and frontend-friendly; do not leak internal DB shape.
 */

// ----- Search -----
export type SearchResultDTO = {
  candidates: SearchCandidateDTO[];
  meta: { query: string; count: number };
};

export type SearchCandidateDTO = {
  mbid: string;
  title: string;
  artistName: string;
  releaseYear: number | null;
  coverUrl: string | null;
  /** Optional; for disambiguation */
  artistMbid?: string | null;
};

// ----- Onboarding favorites -----
export type OnboardingFavoritesResponseDTO = {
  ok: true;
  selectedCount: number;
  preferredArtistsCount: number;
  preferredGenresCount: number;
};

// ----- Weekly drop -----
export type WeeklyDropDTO = {
  id: string;
  weekStart: string;
  frozenUntil: string | null;
  status: 'ACTIVE' | 'EXPIRED';
  items: WeeklyDropItemDTO[];
};

export type WeeklyDropItemDTO = {
  id: string;
  rank: number;
  whyRecommended: string;
  weeklyDropId: string;
  album: WeeklyDropAlbumDTO;
  feedback: WeeklyDropFeedbackDTO;
};

export type WeeklyDropAlbumDTO = {
  id: string;
  title: string;
  artistName: string;
  coverUrl: string | null;
  releaseYear: number | null;
  tags: string[];
};

export type WeeklyDropFeedbackDTO = {
  liked: boolean | null;
  disliked: boolean | null;
  skipped: boolean | null;
  saved: boolean | null;
  rating: number | null;
  reviewText: string | null;
  alreadyListened: boolean | null;
  listenedNotes: string | null;
  notInterestedReason:
    | 'NOT_MY_GENRE'
    | 'DONT_LIKE_ARTIST'
    | 'ALREADY_KNOW_ALBUM'
    | 'TOO_SIMILAR_RECENT'
    | 'MOOD_MISMATCH'
    | 'OTHER'
    | null;
  notInterestedOtherText: string | null;
  updatedAt: string | null;
};

// ----- Weekly drop history -----
export type WeeklyDropHistoryEntryDTO = {
  id: string;
  weekStart: string;
  status: 'ACTIVE' | 'EXPIRED';
  itemCount: number;
};

export type WeeklyDropHistoryResponseDTO = {
  ok: true;
  entries: WeeklyDropHistoryEntryDTO[];
  nextCursor: string | null;
  meta?: { limit: number };
};

// ----- Feedback -----
export type FeedbackResponseDTO = {
  ok: true;
  feedback: WeeklyDropFeedbackDTO;
};

// ----- Weekly drop metrics -----
export type WeeklyDropMetricDTO = {
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

export type WeeklyDropMetricsSummaryDTO = {
  ok: true;
  weeks: number;
  userMetrics: WeeklyDropMetricDTO[];
  globalMetrics: WeeklyDropMetricDTO[];
  comparisons: {
    user: Record<string, number>;
    global: Record<string, number>;
  };
};

// ----- Events -----
export type EventTrackingResponseDTO = {
  ok: true;
};

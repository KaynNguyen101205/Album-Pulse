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

// ----- Events -----
export type EventTrackingResponseDTO = {
  ok: true;
};

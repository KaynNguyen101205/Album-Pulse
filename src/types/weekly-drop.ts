export type WeeklyDropFeedback = {
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

export type WeeklyDropAlbum = {
  id: string;
  title: string;
  artistName: string;
  coverUrl: string | null;
  releaseYear: number | null;
  tags: string[];
};

export type WeeklyDropItem = {
  id: string;
  rank: number;
  whyRecommended: string;
  weeklyDropId: string;
  album: WeeklyDropAlbum;
  feedback: WeeklyDropFeedback;
};

export type WeeklyDrop = {
  id: string;
  weekStart: string;
  status: 'ACTIVE' | 'EXPIRED';
  items: WeeklyDropItem[];
};

export type WeeklyDropHistoryEntry = {
  id: string;
  weekStart: string;
  status: 'ACTIVE' | 'EXPIRED';
  itemCount: number;
};

export type WeeklyDropHistoryPage = {
  entries: WeeklyDropHistoryEntry[];
  nextCursor: string | null;
};

export type WeeklyDropFeedbackPatch = Partial<{
  liked: boolean | null;
  disliked: boolean | null;
  skipped: boolean | null;
  saved: boolean | null;
  rating: number | null;
  reviewText: string | null;
  alreadyListened: boolean | null;
  listenedNotes: string | null;
}>;

export type AnalyticsEventPayload = {
  eventName: string;
  weeklyDropId?: string | null;
  weeklyDropItemId?: string | null;
  metadata?: Record<string, unknown> | null;
};

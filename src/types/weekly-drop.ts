export type NotInterestedReason =
  | 'NOT_MY_GENRE'
  | 'DONT_LIKE_ARTIST'
  | 'ALREADY_KNOW_ALBUM'
  | 'TOO_SIMILAR_RECENT'
  | 'MOOD_MISMATCH'
  | 'OTHER';

export type WeeklyDropFeedback = {
  liked: boolean | null;
  disliked: boolean | null;
  skipped: boolean | null;
  saved: boolean | null;
  rating: number | null;
  reviewText: string | null;
  alreadyListened: boolean | null;
  listenedNotes: string | null;
  notInterestedReason: NotInterestedReason | null;
  notInterestedOtherText: string | null;
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
  notInterestedReason: NotInterestedReason | null;
  notInterestedOtherText: string | null;
}>;

export type WeeklyDropMetric = {
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

export type WeeklyDropMetricsSummary = {
  userMetrics: WeeklyDropMetric[];
  globalMetrics: WeeklyDropMetric[];
  comparisons: {
    user: Record<string, number>;
    global: Record<string, number>;
  };
};

export type AnalyticsEventPayload = {
  eventName: string;
  weeklyDropId?: string | null;
  weeklyDropItemId?: string | null;
  metadata?: Record<string, unknown> | null;
};

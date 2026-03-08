import type { CandidateAlbum } from '../candidateGenerator';

/** Input candidate with optional context for ranking. */
export type CandidateForRanking = CandidateAlbum;

/** Per-component score breakdown (0–1 where higher is better, except where noted). */
export type ScoreBreakdown = {
  similarity: number;
  hiddenGem: number;
  novelty: number;
  diversity: number;
  feedbackAffinity: number;
  suppressionPenalty: number;
  repeatPenalty: number;
};

/** Combined score and breakdown for one candidate. */
export type ScoredCandidate = {
  candidate: CandidateForRanking;
  score: number;
  breakdown: ScoreBreakdown;
};

/** Reason why this album was chosen (for explainability). */
export type RecommendationReason =
  | 'similarity'
  | 'hidden_gem'
  | 'novelty'
  | 'diversity'
  | 'feedback_affinity';

/** User preference that matched (for explanation). */
export type MatchedPreference = {
  type: 'favorite_album' | 'favorite_artist' | 'favorite_tag';
  description: string;
};

/** Final recommended album with explanation. */
export type RankedRecommendation = {
  albumId: string;
  mbid: string;
  title: string;
  artistName: string;
  releaseYear: number | null;
  tags: string[];
  coverUrl: string | null;
  rank: number;
  score: number;
  breakdown: ScoreBreakdown;
  explanation: {
    short: string;
    reasons: RecommendationReason[];
    matchedPreferences: MatchedPreference[];
  };
};

/**
 * Tuning weights for ranking. Adjust here to balance similarity, hidden gems, novelty, and diversity.
 */

export const SCORING_WEIGHTS = {
  similarity: 0.28,
  hiddenGem: 0.2,
  novelty: 0.14,
  diversity: 0.16,
  feedbackAffinity: 0.22,
  suppressionPenalty: 0.2,
  repeatPenalty: 0.16,
} as const;

/** Cosine distance to similarity score: distance 0 -> 1, distance ~1 -> ~0. */
export const SIMILARITY_DISTANCE_SCALE = 2;

/** Popularity score (0–1 from Last.fm) above this gets penalized for hidden-gem. */
export const POPULARITY_PENALTY_THRESHOLD = 0.3;

/** How strongly to penalize high popularity (linear penalty above threshold). */
export const POPULARITY_PENALTY_STRENGTH = 0.8;

/** Default novelty boost for candidates with no recent exposure. */
export const NOVELTY_BOOST_FRESH = 1.0;

/** Novelty penalty for recently recommended (0 = full penalty). */
export const NOVELTY_PENALTY_RECENT = 0;

/** Minimum number of distinct tags in the final 5. */
export const MIN_TAGS_IN_FINAL = 2;

/** Maximum albums per artist in the final 5. */
export const MAX_ALBUMS_PER_ARTIST_IN_FINAL = 1;

/** Number of albums to recommend per weekly drop. */
export const RECOMMENDATIONS_COUNT = 5;

/** MMR lambda: 1 = pure relevance, 0 = pure diversity. */
export const MMR_LAMBDA = 0.7;

/** Soft suppression starts reducing score once strength is above this threshold. */
export const SOFT_SUPPRESSION_THRESHOLD = 0.45;

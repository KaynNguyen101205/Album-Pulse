import type { CandidateForRanking } from './types';
import {
  POPULARITY_PENALTY_THRESHOLD,
  POPULARITY_PENALTY_STRENGTH,
} from './config';

/**
 * Hidden-gem score: penalize high popularity (Last.fm popularityScore 0–1).
 * Lower popularity => higher score (more "gem"). Missing popularity => neutral.
 */
export function hiddenGemScore(candidate: CandidateForRanking): number {
  const pop = candidate.popularityScore;
  if (pop == null || !Number.isFinite(pop)) {
    return 0.5;
  }
  const p = Math.max(0, Math.min(1, pop));
  if (p <= POPULARITY_PENALTY_THRESHOLD) {
    return 0.5 + (1 - p / POPULARITY_PENALTY_THRESHOLD) * 0.5;
  }
  const penalty = (p - POPULARITY_PENALTY_THRESHOLD) * POPULARITY_PENALTY_STRENGTH;
  return Math.max(0, 0.5 - penalty);
}

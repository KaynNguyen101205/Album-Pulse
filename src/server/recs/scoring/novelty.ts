import type { CandidateForRanking } from './types';
import { NOVELTY_BOOST_FRESH, NOVELTY_PENALTY_RECENT } from './config';

export type NoveltyContext = {
  recentlyRecommendedAlbumIds: Set<string>;
};

/**
 * Novelty score: boost fresh candidates, penalize recently recommended.
 * Candidates in recentlyRecommendedAlbumIds get NOVELTY_PENALTY_RECENT; others get NOVELTY_BOOST_FRESH (capped at 1).
 */
export function noveltyScore(
  candidate: CandidateForRanking,
  context: NoveltyContext
): number {
  if (context.recentlyRecommendedAlbumIds.has(candidate.albumId)) {
    return NOVELTY_PENALTY_RECENT;
  }
  return Math.min(1, NOVELTY_BOOST_FRESH);
}

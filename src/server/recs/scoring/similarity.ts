import type { CandidateForRanking } from './types';
import { SIMILARITY_DISTANCE_SCALE } from './config';

/**
 * Vector similarity: rawSignals.distance is cosine distance (lower = more similar).
 * No distance => neutral score when candidate has no vector provenance.
 */
export function similarityScore(candidate: CandidateForRanking): number {
  const distance = candidate.rawSignals?.distance;
  if (typeof distance !== 'number' || !Number.isFinite(distance)) {
    return 0.5;
  }
  const normalized = Math.max(0, 1 - distance / SIMILARITY_DISTANCE_SCALE);
  return Math.min(1, normalized);
}

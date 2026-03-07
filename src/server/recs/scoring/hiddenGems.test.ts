import { describe, it, expect } from 'vitest';
import { hiddenGemScore } from './hiddenGems';
import type { CandidateForRanking } from './types';

function candidate(overrides: Partial<CandidateForRanking>): CandidateForRanking {
  return {
    albumId: '1',
    mbid: 'mbid-1',
    title: 'Album',
    artistName: 'Artist',
    releaseYear: null,
    tags: [],
    coverUrl: null,
    popularityScore: null,
    hasEmbedding: true,
    sources: ['vector'],
    ...overrides,
  };
}

describe('hiddenGemScore', () => {
  it('returns neutral when popularity is missing', () => {
    expect(hiddenGemScore(candidate({ popularityScore: null }))).toBe(0.5);
  });

  it('returns higher score for lower popularity (hidden gem)', () => {
    const low = hiddenGemScore(candidate({ popularityScore: 0.1 }));
    const high = hiddenGemScore(candidate({ popularityScore: 0.9 }));
    expect(low).toBeGreaterThan(high);
  });

  it('penalizes high popularity', () => {
    const score = hiddenGemScore(candidate({ popularityScore: 0.8 }));
    expect(score).toBeLessThan(0.5);
  });
});

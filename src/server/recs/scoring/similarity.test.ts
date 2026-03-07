import { describe, it, expect } from 'vitest';
import { similarityScore } from './similarity';
import type { CandidateForRanking } from './types';

function candidate(overrides: Partial<CandidateForRanking> & { rawSignals?: { distance?: number } }): CandidateForRanking {
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

describe('similarityScore', () => {
  it('returns 1 when distance is 0', () => {
    expect(similarityScore(candidate({ rawSignals: { distance: 0 } }))).toBe(1);
  });

  it('returns lower score for higher distance', () => {
    const d05 = similarityScore(candidate({ rawSignals: { distance: 0.5 } }));
    const d10 = similarityScore(candidate({ rawSignals: { distance: 1 } }));
    const d20 = similarityScore(candidate({ rawSignals: { distance: 2 } }));
    expect(d05).toBeGreaterThan(d10);
    expect(d10).toBeGreaterThan(d20);
  });

  it('returns 0.5 when no distance (neutral)', () => {
    expect(similarityScore(candidate({ rawSignals: {} }))).toBe(0.5);
    expect(similarityScore(candidate({}))).toBe(0.5);
  });
});

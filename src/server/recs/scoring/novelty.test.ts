import { describe, it, expect } from 'vitest';
import { noveltyScore } from './novelty';
import type { CandidateForRanking } from './types';

function candidate(albumId: string): CandidateForRanking {
  return {
    albumId,
    mbid: 'mbid-1',
    title: 'Album',
    artistName: 'Artist',
    releaseYear: null,
    tags: [],
    coverUrl: null,
    popularityScore: null,
    hasEmbedding: true,
    sources: ['vector'],
  };
}

describe('noveltyScore', () => {
  it('returns penalty for recently recommended album', () => {
    const ctx = { recentlyRecommendedAlbumIds: new Set(['a1']) };
    expect(noveltyScore(candidate('a1'), ctx)).toBe(0);
  });

  it('returns boost for fresh album', () => {
    const ctx = { recentlyRecommendedAlbumIds: new Set(['a1']) };
    expect(noveltyScore(candidate('a2'), ctx)).toBe(1);
  });
});

import { describe, it, expect } from 'vitest';
import {
  scoreCandidates,
  selectTopN,
  buildRecommendations,
  rankAlbums,
} from './rankAlbums';
import type { CandidateForRanking } from './types';

function candidate(
  albumId: string,
  artistName: string,
  tags: string[] = [],
  overrides: Partial<CandidateForRanking> = {}
): CandidateForRanking {
  return {
    albumId,
    mbid: `mbid-${albumId}`,
    title: `Album ${albumId}`,
    artistName,
    releaseYear: null,
    tags,
    coverUrl: null,
    popularityScore: null,
    hasEmbedding: true,
    sources: ['vector'],
    rawSignals: { distance: 0.3 },
    ...overrides,
  };
}

const defaultContext = {
  recentlyRecommendedAlbumIds: [] as string[],
  userFavoriteArtistNames: ['Radiohead'],
  userFavoriteTags: ['rock'],
};

describe('scoreCandidates', () => {
  it('returns scored candidates with breakdown', () => {
    const candidates = [
      candidate('1', 'Radiohead', ['rock'], { rawSignals: { distance: 0.2 } }),
    ];
    const scored = scoreCandidates(candidates, defaultContext);
    expect(scored).toHaveLength(1);
    expect(scored[0].breakdown).toHaveProperty('similarity');
    expect(scored[0].breakdown).toHaveProperty('hiddenGem');
    expect(scored[0].breakdown).toHaveProperty('novelty');
    expect(scored[0].breakdown).toHaveProperty('diversity');
    expect(scored[0].score).toBeGreaterThan(0);
  });
});

describe('selectTopN', () => {
  it('respects max 1 per artist', () => {
    const candidates = [
      candidate('1', 'Radiohead'),
      candidate('2', 'Radiohead'),
      candidate('3', 'Radiohead'),
      candidate('4', 'Pink Floyd'),
      candidate('5', 'Muse'),
    ].map((c) => ({
      candidate: c,
      score: 0.8,
      breakdown: { similarity: 0.8, hiddenGem: 0.5, novelty: 0.5, diversity: 0.5 },
    }));
    const selected = selectTopN(candidates, 5);
    const artists = selected.map((s) => s.candidate.artistName);
    const unique = new Set(artists);
    expect(unique.size).toBe(selected.length);
  });

  it('returns at most n', () => {
    const candidates = [
      candidate('1', 'A'),
      candidate('2', 'B'),
      candidate('3', 'C'),
    ].map((c) => ({
      candidate: c,
      score: 0.5,
      breakdown: { similarity: 0.5, hiddenGem: 0.5, novelty: 0.5, diversity: 0.5 },
    }));
    expect(selectTopN(candidates, 5)).toHaveLength(3);
  });
});

describe('buildRecommendations', () => {
  it('includes explanation with short, reasons, matchedPreferences', () => {
    const scored = [
      {
        candidate: candidate('1', 'Radiohead', ['rock']),
        score: 0.7,
        breakdown: {
          similarity: 0.8,
          hiddenGem: 0.5,
          novelty: 0.5,
          diversity: 0.5,
        },
      },
    ];
    const recs = buildRecommendations(scored);
    expect(recs).toHaveLength(1);
    expect(recs[0].explanation.short).toBeTruthy();
    expect(Array.isArray(recs[0].explanation.reasons)).toBe(true);
    expect(Array.isArray(recs[0].explanation.matchedPreferences)).toBe(true);
    expect(recs[0].rank).toBe(1);
  });
});

describe('rankAlbums', () => {
  it('returns at most 5 recommendations', () => {
    const candidates = [
      candidate('1', 'A', ['rock']),
      candidate('2', 'B', ['jazz']),
      candidate('3', 'C', ['rock']),
      candidate('4', 'D', ['electronic']),
      candidate('5', 'E', ['folk']),
      candidate('6', 'F', ['metal']),
    ];
    const result = rankAlbums(candidates, defaultContext);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('returns empty when no candidates', () => {
    expect(rankAlbums([], defaultContext)).toEqual([]);
  });

  it('each recommendation has exactly one artist (no duplicate artists)', () => {
    const candidates = [
      candidate('1', 'Radiohead', ['rock']),
      candidate('2', 'Radiohead', ['alternative']),
      candidate('3', 'Pink Floyd', ['rock']),
      candidate('4', 'Muse', ['rock']),
      candidate('5', 'Coldplay', ['pop']),
      candidate('6', 'U2', ['rock']),
    ];
    const result = rankAlbums(candidates, defaultContext);
    const artists = result.map((r) => r.artistName);
    expect(new Set(artists).size).toBe(artists.length);
  });
});

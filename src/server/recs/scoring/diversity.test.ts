import { describe, it, expect } from 'vitest';
import {
  diversityScoreVsSelected,
  diversityScoreVsUser,
  getArtistKey,
  getTagKeys,
} from './diversity';
import type { ScoredCandidate, CandidateForRanking } from './types';

function scored(
  artistName: string,
  tags: string[] = [],
  overrides: Partial<ScoredCandidate['candidate']> = {}
): ScoredCandidate {
  return {
    candidate: {
      albumId: '1',
      mbid: 'mbid-1',
      title: 'Album',
      artistName,
      releaseYear: null,
      tags,
      coverUrl: null,
      popularityScore: null,
      hasEmbedding: true,
      sources: ['vector'],
      ...overrides,
    },
    score: 0.5,
    breakdown: { similarity: 0.5, hiddenGem: 0.5, novelty: 0.5, diversity: 0.5 },
  };
}

describe('diversityScoreVsSelected', () => {
  it('returns 1 when no selection', () => {
    expect(diversityScoreVsSelected(scored('A'), [])).toBe(1);
  });

  it('returns lower score when same artist already selected', () => {
    const a = scored('Radiohead');
    const b = scored('Radiohead', [], { albumId: '2' });
    expect(diversityScoreVsSelected(b, [a])).toBeLessThan(1);
  });

  it('returns higher score when different artist', () => {
    const a = scored('Radiohead');
    const b = scored('Pink Floyd');
    expect(diversityScoreVsSelected(b, [a])).toBe(1);
  });
});

describe('diversityScoreVsUser', () => {
  it('returns higher score for new artist and new tag', () => {
    const c: CandidateForRanking = {
      albumId: '1',
      mbid: 'm',
      title: 'T',
      artistName: 'NewArtist',
      releaseYear: null,
      tags: ['newtag'],
      coverUrl: null,
      popularityScore: null,
      hasEmbedding: true,
      sources: ['vector'],
    };
    const ctx = { artistNames: ['OldArtist'], tags: ['oldtag'] };
    expect(diversityScoreVsUser(c, ctx)).toBe(0.9);
  });

  it('returns neutral when same artist and tag', () => {
    const c: CandidateForRanking = {
      albumId: '1',
      mbid: 'm',
      title: 'T',
      artistName: 'Same',
      releaseYear: null,
      tags: ['same'],
      coverUrl: null,
      popularityScore: null,
      hasEmbedding: true,
      sources: ['vector'],
    };
    const ctx = { artistNames: ['Same'], tags: ['same'] };
    expect(diversityScoreVsUser(c, ctx)).toBe(0.5);
  });
});

describe('getArtistKey / getTagKeys', () => {
  it('normalizes artist to lowercase', () => {
    expect(getArtistKey(scored('Radiohead'))).toBe('radiohead');
  });
  it('returns tag keys lowercase', () => {
    expect(getTagKeys(scored('A', ['Rock', 'Alternative']))).toEqual([
      'rock',
      'alternative',
    ]);
  });
});

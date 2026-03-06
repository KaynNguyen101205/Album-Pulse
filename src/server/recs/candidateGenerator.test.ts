import { describe, it, expect } from 'vitest';
import {
  getDedupeKey,
  applyArtistCap,
  type CandidateAlbum,
} from './candidateGenerator';

describe('getDedupeKey', () => {
  it('prefers mbid when present', () => {
    expect(
      getDedupeKey('abc-123', 'Album Title', 'Artist Name', 2001)
    ).toBe('mbid:abc-123');
  });

  it('normalizes mbid to lowercase', () => {
    expect(getDedupeKey('ABC-123', '', '', null)).toBe('mbid:abc-123');
  });

  it('uses fallback when mbid is empty', () => {
    const key = getDedupeKey('', 'OK Computer', 'Radiohead', 1997);
    expect(key).toMatch(/^fallback:/);
    expect(key).toContain('radiohead');
    expect(key).toContain('ok computer');
    expect(key).toContain('1997');
  });

  it('same album produces same key', () => {
    const k1 = getDedupeKey('', 'Kid A', 'Radiohead', 2000);
    const k2 = getDedupeKey('', 'Kid A', 'Radiohead', 2000);
    expect(k1).toBe(k2);
  });

  it('different albums produce different keys', () => {
    const k1 = getDedupeKey('', 'Kid A', 'Radiohead', 2000);
    const k2 = getDedupeKey('', 'Amnesiac', 'Radiohead', 2001);
    expect(k1).not.toBe(k2);
  });
});

describe('applyArtistCap', () => {
  function makeCandidate(
    albumId: string,
    artistName: string,
    popularityScore: number | null = null
  ): CandidateAlbum {
    return {
      albumId,
      mbid: `mbid-${albumId}`,
      title: `Album ${albumId}`,
      artistName,
      releaseYear: null,
      tags: [],
      coverUrl: null,
      popularityScore,
      hasEmbedding: true,
      sources: ['vector'],
    };
  }

  it('caps albums per artist to maxPerArtist', () => {
    const candidates: CandidateAlbum[] = [
      makeCandidate('1', 'Radiohead'),
      makeCandidate('2', 'Radiohead'),
      makeCandidate('3', 'Radiohead'),
      makeCandidate('4', 'Radiohead'),
      makeCandidate('5', 'Radiohead'),
      makeCandidate('6', 'Radiohead'),
    ];
    const result = applyArtistCap(candidates, 3);
    const radiohead = result.filter((c) => c.artistName === 'Radiohead');
    expect(radiohead).toHaveLength(3);
  });

  it('keeps albums from different artists', () => {
    const candidates: CandidateAlbum[] = [
      makeCandidate('1', 'Radiohead'),
      makeCandidate('2', 'Radiohead'),
      makeCandidate('3', 'Pink Floyd'),
      makeCandidate('4', 'Pink Floyd'),
    ];
    const result = applyArtistCap(candidates, 2);
    expect(result).toHaveLength(4);
    expect(result.filter((c) => c.artistName === 'Radiohead')).toHaveLength(2);
    expect(result.filter((c) => c.artistName === 'Pink Floyd')).toHaveLength(2);
  });

  it('default max is 5 per artist', () => {
    const candidates: CandidateAlbum[] = Array.from({ length: 10 }, (_, i) =>
      makeCandidate(String(i), 'Same Artist')
    );
    const result = applyArtistCap(candidates);
    expect(result).toHaveLength(5);
  });
});

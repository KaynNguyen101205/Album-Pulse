import { describe, expect, it } from 'vitest';

import type { Album } from '@/types/domain';
import { rankRecommendations } from './engine';

function isoDaysAgo(daysAgo: number): string {
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function makeAlbum(input: {
  id: string;
  spotifyId?: string;
  name?: string;
  artistId: string;
  artistName?: string;
  releaseDate?: string;
}): Album {
  return {
    id: input.id,
    spotifyId: input.spotifyId ?? input.id,
    name: input.name ?? `Album ${input.id}`,
    artistId: input.artistId,
    artistName: input.artistName ?? `Artist ${input.artistId}`,
    releaseDate: input.releaseDate ?? isoDaysAgo(500),
  };
}

describe('rankRecommendations', () => {
  it('dedupes by spotifyId and keeps the higher-scored candidate', () => {
    const result = rankRecommendations(
      [
        { artistId: 'artist-top', name: 'Top Artist', rank: 1 },
        { artistId: 'artist-low', name: 'Low Artist', rank: 20 },
      ],
      [],
      [
        makeAlbum({
          id: 'low-version',
          spotifyId: 'same-spotify-id',
          artistId: 'artist-low',
          artistName: 'Low Artist',
          releaseDate: isoDaysAgo(600),
        }),
        makeAlbum({
          id: 'high-version',
          spotifyId: 'same-spotify-id',
          artistId: 'artist-top',
          artistName: 'Top Artist',
          releaseDate: isoDaysAgo(600),
        }),
      ],
      { limit: 10 }
    );

    expect(result).toHaveLength(1);
    expect(result[0].album.id).toBe('high-version');
    expect(result[0].viTri).toBe(1);
    expect(result[0].reason).toBe(result[0].lyDo);
  });

  it('for same spotifyId and same score, keeps newer release', () => {
    const result = rankRecommendations(
      [{ artistId: 'artist-a', name: 'Artist A', rank: 5 }],
      [],
      [
        makeAlbum({
          id: 'older',
          spotifyId: 'dup-id',
          artistId: 'artist-a',
          releaseDate: isoDaysAgo(120),
        }),
        makeAlbum({
          id: 'newer',
          spotifyId: 'dup-id',
          artistId: 'artist-a',
          releaseDate: isoDaysAgo(20),
        }),
      ],
      { limit: 10 }
    );

    expect(result).toHaveLength(1);
    expect(result[0].album.id).toBe('newer');
  });

  it('sorts by score desc and assigns contiguous viTri', () => {
    const result = rankRecommendations(
      [
        { artistId: 'artist-a', name: 'Artist A', rank: 2 },
        { artistId: 'artist-b', name: 'Artist B', rank: 1 },
        { artistId: 'artist-c', name: 'Artist C', rank: 3 },
      ],
      [],
      [
        makeAlbum({
          id: 'a',
          spotifyId: 'a-spotify',
          artistId: 'artist-a',
          releaseDate: isoDaysAgo(500),
        }),
        makeAlbum({
          id: 'b',
          spotifyId: 'b-spotify',
          artistId: 'artist-b',
          releaseDate: isoDaysAgo(500),
        }),
        makeAlbum({
          id: 'c',
          spotifyId: 'c-spotify',
          artistId: 'artist-c',
          releaseDate: isoDaysAgo(20),
        }),
      ],
      { limit: 10 }
    );

    expect(result.map((item) => item.album.id)).toEqual(['c', 'b', 'a']);
    expect(result.map((item) => item.viTri)).toEqual([1, 2, 3]);
    expect(result[0].score).toBeGreaterThanOrEqual(result[1].score);
    expect(result[1].score).toBeGreaterThanOrEqual(result[2].score);
  });

  it('generates expected lyDo templates', () => {
    const frequent = rankRecommendations(
      [],
      [{ artistId: 'r1', trackCount: 5 }],
      [makeAlbum({ id: 'r1-album', artistId: 'r1', artistName: 'Frequent Artist', releaseDate: isoDaysAgo(700) })],
      { limit: 1 }
    )[0];
    expect(frequent.lyDo).toContain('Nghe nhiều');

    const newRelease = rankRecommendations(
      [],
      [],
      [makeAlbum({ id: 'new-release', artistId: 'n1', artistName: 'New Artist', releaseDate: isoDaysAgo(30) })],
      { limit: 1 }
    )[0];
    expect(newRelease.lyDo).toContain('Album mới:');

    const recentRelease = rankRecommendations(
      [],
      [],
      [makeAlbum({ id: 'recent-release', artistId: 'n2', releaseDate: isoDaysAgo(300) })],
      { limit: 1 }
    )[0];
    expect(recentRelease.lyDo).toBe('Phát hành gần đây');

    const topArtist = rankRecommendations(
      [{ artistId: 'top-1', name: 'Top 1', rank: 1 }],
      [],
      [makeAlbum({ id: 'top-album', artistId: 'top-1', releaseDate: isoDaysAgo(700) })],
      { limit: 1 }
    )[0];
    expect(topArtist.lyDo).toBe('Top artist của bạn');

    const fallback = rankRecommendations(
      [],
      [],
      [makeAlbum({ id: 'fallback', artistId: 'x', releaseDate: isoDaysAgo(700) })],
      { limit: 1 }
    )[0];
    expect(fallback.lyDo).toBe('Có thể hợp gu bạn');
  });

  it('truncates long lyDo to maximum 40 characters', () => {
    const veryLongArtistName =
      'NgheSiCoTenSieuDaiVaRatNhieuKyTuDeTestGioiHanDoDaiLyDo';

    const result = rankRecommendations(
      [],
      [{ artistId: 'long-artist', trackCount: 10 }],
      [
        makeAlbum({
          id: 'long-lydo',
          artistId: 'long-artist',
          artistName: veryLongArtistName,
          releaseDate: isoDaysAgo(700),
        }),
      ],
      { limit: 1 }
    );

    const lyDo = result[0].lyDo;
    expect(Array.from(lyDo).length).toBeLessThanOrEqual(40);
    expect(lyDo.endsWith('...')).toBe(true);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

import { GET } from './route';

const mockRequireSession = vi.fn();
const mockCount = vi.fn();
const mockGetRankingContextForUser = vi.fn();
const mockGenerateCandidatesForUser = vi.fn();
const mockScoreCandidates = vi.fn();
const mockSelectTopN = vi.fn();
const mockBuildRecommendations = vi.fn();

vi.mock('@/lib/session', () => ({
  requireSession: (...args: unknown[]) => mockRequireSession(...args),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    userFavoriteAlbum: {
      count: (...args: unknown[]) => mockCount(...args),
    },
  },
}));

vi.mock('@/server/recs/getRankingContext', () => ({
  getRankingContextForUser: (...args: unknown[]) => mockGetRankingContextForUser(...args),
}));

vi.mock('@/server/recs/candidateGenerator', () => ({
  generateCandidatesForUser: (...args: unknown[]) => mockGenerateCandidatesForUser(...args),
}));

vi.mock('@/server/recs/scoring/rankAlbums', () => ({
  scoreCandidates: (...args: unknown[]) => mockScoreCandidates(...args),
  selectTopN: (...args: unknown[]) => mockSelectTopN(...args),
  buildRecommendations: (...args: unknown[]) => mockBuildRecommendations(...args),
}));

describe('GET /api/albums/suggest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue('user-1');
    mockGetRankingContextForUser.mockResolvedValue({
      recentlyRecommendedAlbumIds: [],
      userFavoriteArtistNames: [],
      userFavoriteTags: [],
      suppressionByAlbum: {},
      suppressionByArtist: {},
      suppressionByTag: {},
      recentArtistCounts: {},
    });
    mockGenerateCandidatesForUser.mockResolvedValue([]);
    mockScoreCandidates.mockReturnValue([]);
    mockSelectTopN.mockReturnValue([]);
    mockBuildRecommendations.mockReturnValue([]);
    mockCount.mockResolvedValue(0);
  });

  it('returns empty payload with hasFavorites=false when there are not enough favorites', async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      ok: true,
      dotGoiYId: null,
      items: [],
      hasFavorites: false,
    });
    expect(mockCount).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
  });

  it('returns ranked dashboard recommendations from the recommendation pipeline', async () => {
    const candidates = [{ albumId: 'album-1', artistName: 'Artist', tags: [] }];
    const scored = [{ candidate: candidates[0], score: 0.9, breakdown: {} }];
    const selected = [scored[0]];
    const recommendations = [
      {
        albumId: 'album-1',
        mbid: 'mbid-1',
        title: 'Album One',
        artistName: 'Artist',
        releaseYear: 2024,
        tags: ['indie'],
        coverUrl: 'https://example.com/cover.jpg',
        rank: 1,
        score: 0.9,
        breakdown: {},
        explanation: {
          short: 'similar to your favorites',
          reasons: ['similarity'],
          matchedPreferences: [],
        },
      },
    ];

    mockGenerateCandidatesForUser.mockResolvedValue(candidates);
    mockScoreCandidates.mockReturnValue(scored);
    mockSelectTopN.mockReturnValue(selected);
    mockBuildRecommendations.mockReturnValue(recommendations);

    const res = await GET();

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.dotGoiYId).toBe(null);
    expect(json.hasFavorites).toBe(true);
    expect(json.items).toEqual([
      {
        score: 0.9,
        diem: 0.9,
        viTri: 1,
        lyDo: 'similar to your favorites',
        reason: 'similar to your favorites',
        album: {
          id: 'album-1',
          spotifyId: 'mbid-1',
          name: 'Album One',
          ten: 'Album One',
          artistName: 'Artist',
          anhBiaUrl: 'https://example.com/cover.jpg',
          releaseDate: '2024',
          ngayPhatHanh: '2024',
          spotifyUrl: null,
        },
      },
    ]);
    expect(mockGenerateCandidatesForUser).toHaveBeenCalledWith('user-1', {
      suppressedAlbumIds: [],
      suppressedArtistNames: [],
      suppressedTags: [],
      recentArtistCounts: {},
    });
    expect(mockSelectTopN).toHaveBeenCalledWith(scored, 1);
  });

  it('passes through unauthorized responses from requireSession', async () => {
    mockRequireSession.mockResolvedValue(
      NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    );

    const res = await GET();

    expect(res.status).toBe(401);
  });
});

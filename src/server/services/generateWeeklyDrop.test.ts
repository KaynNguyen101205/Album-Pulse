import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateWeeklyDropForUser } from './generateWeeklyDrop';

const mockFindUnique = vi.fn();
const mockTransaction = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    weeklyDrop: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => mockTransaction(fn),
  },
}));

vi.mock('@/server/recs/candidateGenerator', () => ({
  generateCandidatesForUser: vi.fn(),
}));

vi.mock('@/server/recs/getRankingContext', () => ({
  getRankingContextForUser: vi.fn(),
}));

vi.mock('@/server/recs/scoring/rankAlbums', () => ({
  rankAlbums: vi.fn(),
}));

import { generateCandidatesForUser } from '@/server/recs/candidateGenerator';
import { getRankingContextForUser } from '@/server/recs/getRankingContext';
import { rankAlbums } from '@/server/recs/scoring/rankAlbums';
import type { RankedRecommendation } from '@/server/recs/scoring/types';

const userId = 'user-1';
const fixedWeekStart = new Date(Date.UTC(2026, 2, 2, 0, 0, 0)); // 2026-03-02 Monday

function oneRecommendation(): RankedRecommendation[] {
  return [
    {
      albumId: 'album-1',
      mbid: 'mbid-1',
      title: 'Test Album',
      artistName: 'Test Artist',
      releaseYear: 2020,
      tags: ['rock'],
      coverUrl: null,
      rank: 1,
      score: 0.9,
      breakdown: {
        similarity: 0.8,
        hiddenGem: 0.5,
        novelty: 1,
        diversity: 0.6,
        feedbackAffinity: 0.55,
        suppressionPenalty: 0,
        repeatPenalty: 0,
      },
      explanation: {
        short: 'Similar to your favorites',
        reasons: ['similarity'],
        matchedPreferences: [{ type: 'favorite_album', description: 'Similar' }],
      },
    },
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(generateCandidatesForUser).mockResolvedValue([
    {
      albumId: 'album-1',
      mbid: 'mbid-1',
      title: 'Test',
      artistName: 'Artist',
      releaseYear: 2020,
      tags: [],
      coverUrl: null,
      popularityScore: null,
      hasEmbedding: true,
      sources: ['vector'],
    },
  ]);
  vi.mocked(getRankingContextForUser).mockResolvedValue({
    recentlyRecommendedAlbumIds: [],
    userFavoriteArtistNames: [],
    userFavoriteTags: [],
  });
  vi.mocked(rankAlbums).mockReturnValue(oneRecommendation());
  mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      weeklyDropItem: {
        deleteMany: vi.fn().mockResolvedValue(undefined),
        createMany: vi.fn().mockResolvedValue(undefined),
      },
      weeklyDrop: {
        delete: vi.fn().mockResolvedValue(undefined),
        create: vi.fn().mockResolvedValue(undefined),
      },
    };
    return fn(tx);
  });
});

describe('generateWeeklyDropForUser', () => {
  it('idempotent: second call without force returns already_exists and does not create duplicate', async () => {
    mockFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'drop-1', status: 'ACTIVE' });

    const r1 = await generateWeeklyDropForUser(userId, { weekStart: fixedWeekStart });
    expect(r1.ok).toBe(true);
    if (!r1.ok) throw new Error('Expected successful generation');
    expect(r1.generated).toBe(true);
    expect(mockTransaction).toHaveBeenCalledTimes(1);

    const r2 = await generateWeeklyDropForUser(userId, { weekStart: fixedWeekStart });
    expect(r2.ok).toBe(true);
    if (!r2.ok) throw new Error('Expected already_exists response');
    expect(r2.generated).toBe(false);
    expect((r2 as { reason: string }).reason).toBe('already_exists');
    expect(mockTransaction).toHaveBeenCalledTimes(1); // still 1, no second transaction
  });

  it('force regenerate: replaces existing drop for same week', async () => {
    const deleteMany = vi.fn().mockResolvedValue(undefined);
    const dropDelete = vi.fn().mockResolvedValue(undefined);
    const dropCreate = vi.fn().mockResolvedValue(undefined);
    const itemsCreateMany = vi.fn().mockResolvedValue(undefined);
    mockFindUnique.mockResolvedValue({ id: 'drop-existing', status: 'ACTIVE' });
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        weeklyDropItem: { deleteMany, createMany: itemsCreateMany },
        weeklyDrop: { delete: dropDelete, create: dropCreate },
      };
      return fn(tx);
    });

    const r = await generateWeeklyDropForUser(userId, {
      weekStart: fixedWeekStart,
      force: true,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('Expected successful force generation');
    expect(r.generated).toBe(true);
    expect(deleteMany).toHaveBeenCalledWith({
      where: { weeklyDropId: 'drop-existing' },
    });
    expect(dropDelete).toHaveBeenCalledWith({ where: { id: 'drop-existing' } });
    expect(dropCreate).toHaveBeenCalled();
    expect(itemsCreateMany).toHaveBeenCalled();
  });

  it('returns no_candidates when candidate pool is empty', async () => {
    mockFindUnique.mockResolvedValue(null);
    vi.mocked(generateCandidatesForUser).mockResolvedValue([]);

    const r = await generateWeeklyDropForUser(userId, { weekStart: fixedWeekStart });
    expect(r.ok).toBe(false);
    expect((r as { error: string }).error).toBe('no_candidates');
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('persists current week with weekKey and frozenUntil', async () => {
    mockFindUnique.mockResolvedValue(null);
    let capturedData: { weekStart: Date; frozenUntil: Date } | null = null;
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        weeklyDropItem: {
          deleteMany: vi.fn().mockResolvedValue(undefined),
          createMany: vi.fn().mockResolvedValue(undefined),
        },
        weeklyDrop: {
          delete: vi.fn().mockResolvedValue(undefined),
          create: vi.fn().mockImplementation((arg: { data: unknown }) => {
            capturedData = (arg.data as { weekStart: Date; frozenUntil: Date }) as {
              weekStart: Date;
              frozenUntil: Date;
            };
            return Promise.resolve(undefined);
          }),
        },
      };
      return fn(tx);
    });

    const r = await generateWeeklyDropForUser(userId, { weekStart: fixedWeekStart });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('Expected successful generation');
    expect(r.weekKey).toBe('2026-03-02');
    expect(capturedData).not.toBeNull();
    expect(capturedData!.weekStart.getTime()).toBe(fixedWeekStart.getTime());
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(capturedData!.frozenUntil.getTime()).toBe(fixedWeekStart.getTime() + sevenDays);
  });
});

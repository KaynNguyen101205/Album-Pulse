import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCurrentWeeklyDrop } from './getCurrentWeeklyDrop';

const mockFindUnique = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    weeklyDrop: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

vi.mock('@/server/scheduler/weekUtils', () => ({
  getCurrentWeekStartUTC: () => new Date(Date.UTC(2026, 2, 2, 0, 0, 0)),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getCurrentWeeklyDrop', () => {
  it('returns null when no drop for current week', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await getCurrentWeeklyDrop('user-1');
    expect(result).toBeNull();
  });

  it('returns null when drop status is not ACTIVE', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'drop-1',
      weekStart: new Date(Date.UTC(2026, 2, 2)),
      frozenUntil: new Date(Date.UTC(2026, 2, 9)),
      generatedAt: new Date(),
      status: 'EXPIRED',
      items: [],
    });

    const result = await getCurrentWeeklyDrop('user-1');
    expect(result).toBeNull();
  });

  it('returns drop with items for current week (7-day freeze: same drop all week)', async () => {
    const weekStart = new Date(Date.UTC(2026, 2, 2, 0, 0, 0));
    const frozenUntil = new Date(Date.UTC(2026, 2, 9, 0, 0, 0));
    mockFindUnique.mockResolvedValue({
      id: 'drop-1',
      weekStart,
      frozenUntil,
      generatedAt: new Date(),
      status: 'ACTIVE',
      items: [
        {
          albumId: 'album-1',
          rank: 1,
          reason: { short: 'Similar to your favorites' },
          album: {
            id: 'album-1',
            mbid: 'mbid-1',
            title: 'Test',
            coverUrl: null,
            releaseYear: 2020,
            artist: { name: 'Artist' },
          },
        },
      ],
    });

    const result = await getCurrentWeeklyDrop('user-1');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('drop-1');
    expect(result!.status).toBe('ACTIVE');
    expect(result!.frozenUntil).toEqual(frozenUntil);
    expect(result!.items).toHaveLength(1);
    expect(result!.items[0].rank).toBe(1);
    expect(result!.items[0].album.title).toBe('Test');
  });
});

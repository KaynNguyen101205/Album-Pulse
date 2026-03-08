import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQueryRawUnsafe = vi.fn();
const mockRunUpsert = vi.fn();
const mockRunUpdate = vi.fn();
const mockProfileUpsert = vi.fn();
const mockSuppressionDeleteMany = vi.fn();
const mockSuppressionCreateMany = vi.fn();
const mockTransaction = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRawUnsafe: (...args: unknown[]) => mockQueryRawUnsafe(...args),
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => mockTransaction(fn),
    userProfileRecomputeRun: {
      upsert: (...args: unknown[]) => mockRunUpsert(...args),
    },
  },
}));

import { recomputeUserPreferenceProfile } from './recomputeUserProfile';

beforeEach(() => {
  vi.clearAllMocks();
  mockRunUpsert.mockResolvedValue(undefined);
  mockRunUpdate.mockResolvedValue(undefined);
  mockProfileUpsert.mockResolvedValue(undefined);
  mockSuppressionDeleteMany.mockResolvedValue(undefined);
  mockSuppressionCreateMany.mockResolvedValue(undefined);
  mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      userPreferenceProfile: { upsert: mockProfileUpsert },
      userPreferenceSuppression: {
        deleteMany: mockSuppressionDeleteMany,
        createMany: mockSuppressionCreateMany,
      },
      userProfileRecomputeRun: { update: mockRunUpdate },
    };
    return fn(tx);
  });
});

describe('recomputeUserPreferenceProfile', () => {
  it('is rerun-safe for the same user/week by using deterministic upsert keys', async () => {
    mockQueryRawUnsafe.mockResolvedValue([
      {
        feedbackId: 'feedback-1',
        updatedAt: new Date(Date.UTC(2026, 1, 23)),
        liked: true,
        disliked: null,
        skipped: null,
        saved: true,
        rating: 5,
        reviewText: 'great',
        alreadyListened: false,
        notInterestedReason: null,
        notInterestedOtherText: null,
        albumId: 'album-1',
        artistName: 'Artist 1',
        tags: ['rock', 'alt'],
      },
    ]);

    const weekStart = new Date(Date.UTC(2026, 2, 2, 0, 0, 0));
    const first = await recomputeUserPreferenceProfile('user-1', { weekStart });
    const second = await recomputeUserPreferenceProfile('user-1', { weekStart });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(mockRunUpsert).toHaveBeenCalledTimes(2);
    expect(mockRunUpdate).toHaveBeenCalledTimes(2);
    expect(mockProfileUpsert).toHaveBeenCalledTimes(2);
    expect(mockSuppressionDeleteMany).toHaveBeenCalledTimes(2);

    const whereA = mockRunUpsert.mock.calls[0][0].where;
    const whereB = mockRunUpsert.mock.calls[1][0].where;
    expect(whereA).toEqual(whereB);
  });

  it('marks run as failed when recompute throws', async () => {
    mockQueryRawUnsafe.mockRejectedValue(new Error('db unavailable'));

    const result = await recomputeUserPreferenceProfile('user-2', {
      weekStart: new Date(Date.UTC(2026, 2, 2, 0, 0, 0)),
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('db unavailable');
    expect(mockRunUpsert).toHaveBeenCalledTimes(2);
    expect(mockRunUpsert.mock.calls[1][0].update.status).toBe('FAILED');
  });
});

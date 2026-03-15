import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getActiveUserIds } from './activeUsers';

const mockFindMany = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    session: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getActiveUserIds', () => {
  it('returns distinct user IDs that have a session with expires >= cutoff', async () => {
    // Prisma findMany with distinct: ['userId'] returns one row per userId
    mockFindMany.mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }]);

    const ids = await getActiveUserIds();
    expect(ids).toEqual(['user-1', 'user-2']);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { expires: { gte: expect.any(Date) } },
      select: { userId: true },
      distinct: ['userId'],
    });
  });

  it('inactive user skip: returns empty when no sessions in window', async () => {
    mockFindMany.mockResolvedValue([]);

    const ids = await getActiveUserIds();
    expect(ids).toEqual([]);
  });
});

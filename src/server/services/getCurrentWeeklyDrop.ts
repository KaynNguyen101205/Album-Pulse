import { prisma } from '@/lib/prisma';
import { getCurrentWeekStartUTC } from '@/server/scheduler/weekUtils';

export type CurrentWeeklyDropItem = {
  albumId: string;
  rank: number;
  reason: { short?: string; reasons?: string[]; matchedPreferences?: unknown[] } | null;
  album: {
    id: string;
    mbid: string;
    title: string;
    coverUrl: string | null;
    releaseYear: number | null;
    artist: { name: string };
  };
};

export type CurrentWeeklyDrop = {
  id: string;
  weekStart: Date;
  frozenUntil: Date | null;
  generatedAt: Date | null;
  status: string;
  items: CurrentWeeklyDropItem[];
};

/**
 * Returns the user's active weekly drop for the current week (Monday UTC), or null if none.
 * The list is frozen for 7 days; no mid-week changes.
 */
export async function getCurrentWeeklyDrop(userId: string): Promise<CurrentWeeklyDrop | null> {
  const weekStart = getCurrentWeekStartUTC();
  const drop = await prisma.weeklyDrop.findUnique({
    where: {
      userId_weekStart: { userId, weekStart },
    },
    include: {
      items: {
        orderBy: { rank: 'asc' },
        include: {
          album: {
            select: {
              id: true,
              mbid: true,
              title: true,
              coverUrl: true,
              releaseYear: true,
              artist: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!drop || drop.status !== 'ACTIVE') return null;

  return {
    id: drop.id,
    weekStart: drop.weekStart,
    frozenUntil: drop.frozenUntil,
    generatedAt: drop.generatedAt,
    status: drop.status,
    items: drop.items.map((item) => ({
      albumId: item.albumId,
      rank: item.rank,
      reason: item.reason as CurrentWeeklyDropItem['reason'],
      album: {
        id: item.album.id,
        mbid: item.album.mbid,
        title: item.album.title,
        coverUrl: item.album.coverUrl,
        releaseYear: item.album.releaseYear,
        artist: { name: item.album.artist.name },
      },
    })),
  };
}

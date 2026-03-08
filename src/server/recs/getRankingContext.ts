import { prisma } from '@/lib/prisma';
import { FEEDBACK_LOOP_CONFIG } from '@/lib/recommendation/config';
import { normalizeToken } from '@/lib/recommendation/feedback-weights';
import type { RankAlbumsContext } from './scoring/rankAlbums';

const RECENTLY_RECOMMENDED_WEEKS = 8;

/**
 * Fetch context needed for ranking: recently recommended album IDs, user's favorite artists and tags.
 */
export async function getRankingContextForUser(
  userId: string
): Promise<RankAlbumsContext> {
  const [recentAlbumIds, favoriteArtistsAndTags, profileWeights, activeSuppressions, recentRepeatCounts] = await Promise.all([
    getRecentlyRecommendedAlbumIds(userId),
    getFavoriteArtistsAndTags(userId),
    getProfileWeights(userId),
    getActiveSuppressions(userId),
    getRecentRepeatCounts(userId),
  ]);

  return {
    recentlyRecommendedAlbumIds: recentAlbumIds,
    userFavoriteArtistNames: favoriteArtistsAndTags.artistNames,
    userFavoriteTags: favoriteArtistsAndTags.tags,
    profileArtistWeights: profileWeights.artistWeights,
    profileTagWeights: profileWeights.tagWeights,
    profileAlbumWeights: profileWeights.albumWeights,
    suppressionByArtist: activeSuppressions.artists,
    suppressionByTag: activeSuppressions.tags,
    suppressionByAlbum: activeSuppressions.albums,
    recentArtistCounts: recentRepeatCounts.artistCounts,
    recentTagCounts: recentRepeatCounts.tagCounts,
  };
}

async function getRecentlyRecommendedAlbumIds(
  userId: string
): Promise<string[]> {
  const daysBack = RECENTLY_RECOMMENDED_WEEKS * 7;
  const rows = await prisma.$queryRawUnsafe<Array<{ albumId: string }>>(
    `SELECT wdi."albumId" FROM "WeeklyDropItem" wdi
     JOIN "WeeklyDrop" wd ON wd."id" = wdi."weeklyDropId"
     WHERE wd."userId" = $1
       AND wd."weekStart" >= CURRENT_DATE - (($2::text || ' days')::interval)`,
    userId,
    String(daysBack)
  );
  return rows.map((r) => r.albumId);
}

async function getFavoriteArtistsAndTags(userId: string): Promise<{
  artistNames: string[];
  tags: string[];
}> {
  const favorites = await prisma.$queryRawUnsafe<
    Array<{ albumId: string; artistName: string }>
  >(
    `SELECT a."id" AS "albumId", ar."name" AS "artistName"
     FROM "UserFavoriteAlbum" ufa
     JOIN "Album" a ON a."id" = ufa."albumId"
     JOIN "Artist" ar ON ar."id" = a."artistId"
     WHERE ufa."userId" = $1`,
    userId
  );
  const artistNames = Array.from(
    new Set(favorites.map((f) => normalizeToken(f.artistName)).filter(Boolean))
  );
  const albumIds = favorites.map((f) => f.albumId);

  if (albumIds.length === 0) {
    return { artistNames, tags: [] };
  }

  const placeholders = albumIds.map((_, i) => `$${i + 1}`).join(',');
  const tagRows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `SELECT DISTINCT t."name" FROM "AlbumTag" at2
     JOIN "Tag" t ON t."id" = at2."tagId"
     WHERE at2."albumId" IN (${placeholders})`,
    ...albumIds
  );
  const tags = tagRows.map((r) => normalizeToken(r.name)).filter(Boolean);

  return { artistNames, tags };
}

function normalizeWeightMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const output: Record<string, number> = {};
  for (const [rawKey, rawValue] of Object.entries(value)) {
    const key = normalizeToken(rawKey);
    if (!key || typeof rawValue !== 'number' || !Number.isFinite(rawValue)) continue;
    output[key] = rawValue;
  }
  return output;
}

async function getProfileWeights(userId: string): Promise<{
  artistWeights: Record<string, number>;
  tagWeights: Record<string, number>;
  albumWeights: Record<string, number>;
}> {
  const row = await prisma.userPreferenceProfile.findUnique({
    where: { userId },
    select: {
      artistWeights: true,
      tagWeights: true,
      albumWeights: true,
    },
  });
  return {
    artistWeights: normalizeWeightMap(row?.artistWeights),
    tagWeights: normalizeWeightMap(row?.tagWeights),
    albumWeights: normalizeWeightMap(row?.albumWeights),
  };
}

async function getActiveSuppressions(userId: string): Promise<{
  artists: Record<string, number>;
  tags: Record<string, number>;
  albums: Record<string, number>;
}> {
  const rows = await prisma.userPreferenceSuppression.findMany({
    where: {
      userId,
      expiresAt: { gte: new Date() },
    },
    select: {
      targetType: true,
      targetValue: true,
      strength: true,
    },
  });

  const artists: Record<string, number> = {};
  const tags: Record<string, number> = {};
  const albums: Record<string, number> = {};

  for (const row of rows) {
    const key = normalizeToken(row.targetValue);
    if (!key) continue;
    if (row.targetType === 'ARTIST') artists[key] = row.strength;
    else if (row.targetType === 'TAG') tags[key] = row.strength;
    else albums[key] = row.strength;
  }

  return { artists, tags, albums };
}

async function getRecentRepeatCounts(userId: string): Promise<{
  artistCounts: Record<string, number>;
  tagCounts: Record<string, number>;
}> {
  const daysBack = FEEDBACK_LOOP_CONFIG.artistRepeatWindowWeeks * 7;
  const [artistRows, tagRows] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ key: string; count: number }>>(
      `SELECT LOWER(ar."name") AS "key", COUNT(*)::int AS "count"
       FROM "WeeklyDropItem" wdi
       JOIN "WeeklyDrop" wd ON wd."id" = wdi."weeklyDropId"
       JOIN "Album" a ON a."id" = wdi."albumId"
       JOIN "Artist" ar ON ar."id" = a."artistId"
       WHERE wd."userId" = $1
         AND wd."weekStart" >= CURRENT_DATE - (($2::text || ' days')::interval)
       GROUP BY LOWER(ar."name")`,
      userId,
      String(daysBack)
    ),
    prisma.$queryRawUnsafe<Array<{ key: string; count: number }>>(
      `SELECT LOWER(t."name") AS "key", COUNT(*)::int AS "count"
       FROM "WeeklyDropItem" wdi
       JOIN "WeeklyDrop" wd ON wd."id" = wdi."weeklyDropId"
       JOIN "AlbumTag" at2 ON at2."albumId" = wdi."albumId"
       JOIN "Tag" t ON t."id" = at2."tagId"
       WHERE wd."userId" = $1
         AND wd."weekStart" >= CURRENT_DATE - (($2::text || ' days')::interval)
       GROUP BY LOWER(t."name")`,
      userId,
      String(daysBack)
    ),
  ]);

  const artistCounts: Record<string, number> = {};
  const tagCounts: Record<string, number> = {};
  artistRows.forEach((row) => {
    const key = normalizeToken(row.key);
    if (key) artistCounts[key] = Number(row.count) || 0;
  });
  tagRows.forEach((row) => {
    const key = normalizeToken(row.key);
    if (key) tagCounts[key] = Number(row.count) || 0;
  });
  return { artistCounts, tagCounts };
}

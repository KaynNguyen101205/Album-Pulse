import { prisma } from '@/lib/prisma';
import type { RankAlbumsContext } from './scoring/rankAlbums';

const RECENTLY_RECOMMENDED_WEEKS = 8;

/**
 * Fetch context needed for ranking: recently recommended album IDs, user's favorite artists and tags.
 */
export async function getRankingContextForUser(
  userId: string
): Promise<RankAlbumsContext> {
  const [recentAlbumIds, favoriteArtistsAndTags] = await Promise.all([
    getRecentlyRecommendedAlbumIds(userId),
    getFavoriteArtistsAndTags(userId),
  ]);

  return {
    recentlyRecommendedAlbumIds: recentAlbumIds,
    userFavoriteArtistNames: favoriteArtistsAndTags.artistNames,
    userFavoriteTags: favoriteArtistsAndTags.tags,
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
  const artistNames = [...new Set(favorites.map((f) => f.artistName).filter(Boolean))];
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
  const tags = tagRows.map((r) => r.name.toLowerCase());

  return { artistNames, tags };
}

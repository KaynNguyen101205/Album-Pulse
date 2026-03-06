import { prisma } from '@/lib/prisma';
import { getVectorCandidates } from './sources/vectorSource';
import { getArtistExpansionCandidates } from './sources/artistExpansionSource';
import { getTagExpansionCandidates } from './sources/tagExpansionSource';
import type { VectorCandidate } from './sources/vectorSource';
import type { ArtistExpansionCandidate } from './sources/artistExpansionSource';
import type { TagExpansionCandidate } from './sources/tagExpansionSource';

export type CandidateAlbum = {
  albumId: string;
  mbid: string;
  title: string;
  artistName: string;
  releaseYear: number | null;
  tags: string[];
  coverUrl: string | null;
  popularityScore: number | null;
  hasEmbedding: boolean;
  sources: ('vector' | 'artist' | 'tag')[];
  rawSignals?: Record<string, unknown>;
};

const MIN_FAVORITES = 3;
const TARGET_MIN = 100;
const TARGET_MAX = 500;
const MAX_ALBUMS_PER_ARTIST = 5;
const RECENTLY_RECOMMENDED_WEEKS = 8;

function normalizeForDedupe(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '');
}

/**
 * Canonical dedupe key: prefer mbid, fallback to normalized title+artist+year.
 */
export function getDedupeKey(
  mbid: string,
  title: string,
  artistName: string,
  releaseYear: number | null
): string {
  if (mbid?.trim()) return `mbid:${mbid.trim().toLowerCase()}`;
  const t = normalizeForDedupe(title);
  const a = normalizeForDedupe(artistName);
  const y = releaseYear != null ? String(releaseYear) : '';
  return `fallback:${a}|${t}|${y}`;
}

type RawCandidate =
  | VectorCandidate
  | ArtistExpansionCandidate
  | TagExpansionCandidate;

function toCandidateAlbum(c: RawCandidate): CandidateAlbum {
  const sources: ('vector' | 'artist' | 'tag')[] = [];
  if (c.fromVector) sources.push('vector');
  if (c.fromArtistExpansion) sources.push('artist');
  if (c.fromTagExpansion) sources.push('tag');

  return {
    albumId: c.albumId,
    mbid: c.mbid,
    title: c.title,
    artistName: c.artistName,
    releaseYear: c.releaseYear,
    tags: [...(c.tags ?? [])],
    coverUrl: c.coverUrl,
    popularityScore: c.popularityScore,
    hasEmbedding: c.hasEmbedding,
    sources,
    rawSignals: c.rawSignals as Record<string, unknown> | undefined,
  };
}

function mergeCandidates(
  existing: CandidateAlbum,
  incoming: RawCandidate
): CandidateAlbum {
  const sources = new Set(existing.sources);
  if (incoming.fromVector) sources.add('vector');
  if (incoming.fromArtistExpansion) sources.add('artist');
  if (incoming.fromTagExpansion) sources.add('tag');

  const merged = toCandidateAlbum(incoming);
  merged.sources = Array.from(sources);
  merged.rawSignals = { ...existing.rawSignals, ...incoming.rawSignals };
  return merged;
}

/**
 * Fetch excluded album IDs for a user:
 * - favorited, rated, reviewed, disliked (UserEvent), recently recommended.
 */
async function getExcludedAlbumIds(userId: string): Promise<Set<string>> {
  const excluded = new Set<string>();

  const favorites = await prisma.$queryRawUnsafe<
    Array<{ albumId: string }>
  >(
    `SELECT "albumId" FROM "UserFavoriteAlbum" WHERE "userId" = $1`,
    userId
  );
  favorites.forEach((r) => excluded.add(r.albumId));

  const rated = await prisma.$queryRawUnsafe<Array<{ albumId: string }>>(
    `SELECT "albumId" FROM "AlbumRating" WHERE "userId" = $1`,
    userId
  );
  rated.forEach((r) => excluded.add(r.albumId));

  const reviewed = await prisma.$queryRawUnsafe<Array<{ albumId: string }>>(
    `SELECT "albumId" FROM "AlbumReview" WHERE "userId" = $1`,
    userId
  );
  reviewed.forEach((r) => excluded.add(r.albumId));

  const disliked = await prisma.$queryRawUnsafe<
    Array<{ albumId: string }>
  >(
    `SELECT "albumId" FROM "UserEvent" WHERE "userId" = $1 AND "type" = 'DISLIKE' AND "albumId" IS NOT NULL`,
    userId
  );
  disliked.forEach((r) => excluded.add(r.albumId!));

  const daysBack = RECENTLY_RECOMMENDED_WEEKS * 7;
  const recentlyRecommended = await prisma.$queryRawUnsafe<
    Array<{ albumId: string }>
  >(
    `SELECT wdi."albumId" FROM "WeeklyDropItem" wdi
     JOIN "WeeklyDrop" wd ON wd."id" = wdi."weeklyDropId"
     WHERE wd."userId" = $1
       AND wd."weekStart" >= CURRENT_DATE - (($2::text || ' days')::interval)`,
    userId,
    String(daysBack)
  );
  recentlyRecommended.forEach((r) => excluded.add(r.albumId));

  return excluded;
}

/**
 * Apply artist cap: max X albums per artist in the pool.
 */
export function applyArtistCap(
  candidates: CandidateAlbum[],
  maxPerArtist = MAX_ALBUMS_PER_ARTIST
): CandidateAlbum[] {
  const byArtist = new Map<string, CandidateAlbum[]>();
  for (const c of candidates) {
    const key = c.artistName.trim().toLowerCase();
    if (!key) continue;
    const list = byArtist.get(key) ?? [];
    list.push(c);
    byArtist.set(key, list);
  }

  const result: CandidateAlbum[] = [];
  for (const list of byArtist.values()) {
    const capped = list.slice(0, maxPerArtist);
    result.push(...capped);
  }
  return result;
}

/**
 * Generate candidate pool for a user's Weekly Drop.
 * Requires >= 3 favorites. Returns 200-500 (min 100) unique candidates.
 */
export async function generateCandidatesForUser(
  userId: string,
  options?: {
    weekStart?: Date;
    maxCandidates?: number;
    userPreferredTags?: string[];
  }
): Promise<CandidateAlbum[]> {
  const maxCandidates = options?.maxCandidates ?? TARGET_MAX;

  const favorites = await prisma.$queryRawUnsafe<
    Array<{
      albumId: string;
      mbid: string;
      title: string;
      artistName: string;
      artistMbid: string | null;
    }>
  >(
    `SELECT a."id" AS "albumId", a."mbid", a."title", ar."name" AS "artistName", ar."mbid" AS "artistMbid"
     FROM "UserFavoriteAlbum" ufa
     JOIN "Album" a ON a."id" = ufa."albumId"
     JOIN "Artist" ar ON ar."id" = a."artistId"
     WHERE ufa."userId" = $1
     ORDER BY ufa."addedAt" DESC`,
    userId
  );

  if (favorites.length < MIN_FAVORITES) {
    console.warn(
      `[generateCandidates] user ${userId} has ${favorites.length} favorites, need >= ${MIN_FAVORITES}`
    );
    return [];
  }

  const favoriteAlbumIds = favorites.map((f) => f.albumId);
  const favoriteArtistNames = [
    ...new Set(favorites.map((f) => f.artistName).filter(Boolean)),
  ];

  const favoriteTags = await prisma.$queryRawUnsafe<
    Array<{ name: string }>
  >(
    `SELECT DISTINCT t."name" FROM "AlbumTag" at2
     JOIN "Tag" t ON t."id" = at2."tagId"
     WHERE at2."albumId" IN (${favoriteAlbumIds.map((_, i) => `$${i + 1}`).join(',')})`,
    ...favoriteAlbumIds
  );
  const tagsFromFavorites = favoriteTags.map((t) => t.name.toLowerCase());
  const userPreferredTags = options?.userPreferredTags ?? [];
  const allTags = [
    ...new Set([...tagsFromFavorites, ...userPreferredTags.map((t) => t.toLowerCase())]),
  ].slice(0, 8);

  const excludedIds = await getExcludedAlbumIds(userId);

  const [vectorCands, artistCands, tagCands] = await Promise.all([
    getVectorCandidates(favoriteAlbumIds, 60),
    getArtistExpansionCandidates(favoriteArtistNames, 10, 12),
    getTagExpansionCandidates(allTags, 20),
  ]);

  const byDedupeKey = new Map<string, CandidateAlbum>();

  for (const c of vectorCands) {
    if (excludedIds.has(c.albumId)) continue;
    if (!c.title?.trim() || !c.artistName?.trim()) continue;
    const key = getDedupeKey(c.mbid, c.title, c.artistName, c.releaseYear);
    const existing = byDedupeKey.get(key);
    if (existing) {
      byDedupeKey.set(key, mergeCandidates(existing, c));
    } else {
      byDedupeKey.set(key, toCandidateAlbum(c));
    }
  }

  for (const c of artistCands) {
    if (excludedIds.has(c.albumId)) continue;
    if (!c.title?.trim() || !c.artistName?.trim()) continue;
    const key = getDedupeKey(c.mbid, c.title, c.artistName, c.releaseYear);
    const existing = byDedupeKey.get(key);
    if (existing) {
      byDedupeKey.set(key, mergeCandidates(existing, c));
    } else {
      byDedupeKey.set(key, toCandidateAlbum(c));
    }
  }

  for (const c of tagCands) {
    if (excludedIds.has(c.albumId)) continue;
    if (!c.title?.trim() || !c.artistName?.trim()) continue;
    const key = getDedupeKey(c.mbid, c.title, c.artistName, c.releaseYear);
    const existing = byDedupeKey.get(key);
    if (existing) {
      byDedupeKey.set(key, mergeCandidates(existing, c));
    } else {
      byDedupeKey.set(key, toCandidateAlbum(c));
    }
  }

  let pool = Array.from(byDedupeKey.values());
  pool = applyArtistCap(pool, MAX_ALBUMS_PER_ARTIST);
  pool = pool.slice(0, maxCandidates);

  if (process.env.NODE_ENV === 'development') {
    const fromVector = pool.filter((p) => p.sources.includes('vector')).length;
    const fromArtist = pool.filter((p) => p.sources.includes('artist')).length;
    const fromTag = pool.filter((p) => p.sources.includes('tag')).length;
    console.info('[generateCandidates]', {
      userId,
      count: pool.length,
      fromVector,
      fromArtist,
      fromTag,
    });
  }

  return pool;
}

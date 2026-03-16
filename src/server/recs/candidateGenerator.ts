import { prisma } from '@/lib/prisma';
import { FEEDBACK_LOOP_CONFIG } from '@/lib/recommendation/config';
import { isArtistOverRepeatCap } from '@/lib/recommendation/cooldowns';
import { normalizeToken } from '@/lib/recommendation/feedback-weights';
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
const CATALOG_FALLBACK_PER_ARTIST = 15;
const CATALOG_FALLBACK_MAX_TOTAL = 150;

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
    `SELECT "albumId" FROM "UserEvent"
     WHERE "userId" = $1
       AND "type" = 'DISLIKE'
       AND "albumId" IS NOT NULL
       AND "createdAt" >= CURRENT_DATE - (($2::text || ' days')::interval)`,
    userId,
    String(FEEDBACK_LOOP_CONFIG.artistSuppressionWeeks * 7)
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
 * Fallback when vector/artist/tag sources return no candidates: get other albums
 * by the same artist(s) as the user's favorites from our catalog (DB only).
 * Ensures we can still generate a weekly drop when embeddings/Last.fm are missing or empty.
 */
async function getCatalogFallbackCandidates(
  userId: string,
  favoriteAlbumIds: string[],
  excludedIds: Set<string>,
  suppressedAlbumIds: Set<string>,
  suppressedArtistNames: Set<string>,
  recentArtistCounts: Record<string, number>,
  artistRepeatCapInWindow: number
): Promise<CandidateAlbum[]> {
  if (favoriteAlbumIds.length === 0) return [];

  const artistRows = await prisma.$queryRawUnsafe<
    Array<{ artistId: string; artistName: string }>
  >(
    `SELECT DISTINCT a."artistId" AS "artistId", ar."name" AS "artistName"
     FROM "UserFavoriteAlbum" ufa
     JOIN "Album" a ON a."id" = ufa."albumId"
     JOIN "Artist" ar ON ar."id" = a."artistId"
     WHERE ufa."userId" = $1 AND ufa."albumId" IN (${favoriteAlbumIds.map((_, i) => `$${i + 2}`).join(',')})`,
    userId,
    ...favoriteAlbumIds
  );

  const candidates: CandidateAlbum[] = [];
  const seenAlbumId = new Set<string>();

  for (const { artistId, artistName } of artistRows) {
    if (isArtistOverRepeatCap(artistName, recentArtistCounts, artistRepeatCapInWindow)) continue;
    if (suppressedArtistNames.has(normalizeToken(artistName))) continue;

    const placeholders = favoriteAlbumIds.map((_, i) => `$${i + 2}`).join(',');
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        mbid: string;
        title: string;
        releaseYear: number | null;
        coverUrl: string | null;
        popularityScore: number | null;
        tagNames: string[] | null;
      }>
    >(
      `SELECT a."id", a."mbid", a."title", a."releaseYear", a."coverUrl", a."popularityScore",
              (SELECT array_agg(t."name") FROM "AlbumTag" at2
               JOIN "Tag" t ON t."id" = at2."tagId" WHERE at2."albumId" = a."id") AS "tagNames"
       FROM "Album" a
       WHERE a."artistId" = $1
         AND a."id" NOT IN (${placeholders})
       ORDER BY a."releaseYear" DESC NULLS LAST, a."title" ASC
       LIMIT ${CATALOG_FALLBACK_PER_ARTIST}`,
      artistId,
      ...favoriteAlbumIds
    );

    for (const row of rows) {
      if (excludedIds.has(row.id) || suppressedAlbumIds.has(normalizeToken(row.id)) || seenAlbumId.has(row.id)) continue;
      if (!row.title?.trim() || !artistName?.trim()) continue;
      seenAlbumId.add(row.id);
      candidates.push({
        albumId: row.id,
        mbid: row.mbid,
        title: row.title,
        artistName,
        releaseYear: row.releaseYear,
        tags: Array.isArray(row.tagNames) ? row.tagNames : [],
        coverUrl: row.coverUrl,
        popularityScore: row.popularityScore,
        hasEmbedding: false,
        sources: ['artist'],
      });
    }
  }

  return candidates.slice(0, CATALOG_FALLBACK_MAX_TOTAL);
}

const TAG_OVERLAP_FALLBACK_MAX = 80;

/**
 * Last-resort fallback: albums that share at least one tag with any favorite (from catalog).
 * Excludes favorites and applies same filters. Increases chance of hidden-gem candidates.
 */
async function getTagOverlapFallbackCandidates(
  favoriteAlbumIds: string[],
  excludedIds: Set<string>,
  suppressedAlbumIds: Set<string>,
  suppressedArtistNames: Set<string>,
  recentArtistCounts: Record<string, number>,
  artistRepeatCapInWindow: number
): Promise<CandidateAlbum[]> {
  if (favoriteAlbumIds.length === 0) return [];

  const n = favoriteAlbumIds.length;
  const placeholdersFav = favoriteAlbumIds.map((_, i) => `$${i + 1}`).join(',');
  const placeholdersNot = favoriteAlbumIds.map((_, i) => `$${n + i + 1}`).join(',');
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      mbid: string;
      title: string;
      artistName: string;
      releaseYear: number | null;
      coverUrl: string | null;
      popularityScore: number | null;
      tagNames: string[] | null;
    }>
  >(
    `SELECT a."id", a."mbid", a."title", ar."name" AS "artistName",
            a."releaseYear", a."coverUrl", a."popularityScore",
            (SELECT array_agg(t."name") FROM "AlbumTag" at2
             JOIN "Tag" t ON t."id" = at2."tagId" WHERE at2."albumId" = a."id") AS "tagNames"
     FROM "AlbumTag" at_fav
     JOIN "Tag" t_fav ON t_fav."id" = at_fav."tagId"
     JOIN "AlbumTag" at2 ON at2."tagId" = t_fav."id" AND at2."albumId" NOT IN (${placeholdersNot})
     JOIN "Album" a ON a."id" = at2."albumId"
     JOIN "Artist" ar ON ar."id" = a."artistId"
     WHERE at_fav."albumId" IN (${placeholdersFav})
     ORDER BY a."popularityScore" ASC NULLS LAST, a."releaseYear" DESC NULLS LAST
     LIMIT ${TAG_OVERLAP_FALLBACK_MAX}`,
    ...favoriteAlbumIds,
    ...favoriteAlbumIds
  );

  const candidates: CandidateAlbum[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (excludedIds.has(row.id) || suppressedAlbumIds.has(normalizeToken(row.id)) || suppressedArtistNames.has(normalizeToken(row.artistName)) || seen.has(row.id)) continue;
    if (isArtistOverRepeatCap(row.artistName, recentArtistCounts, artistRepeatCapInWindow)) continue;
    if (!row.title?.trim() || !row.artistName?.trim()) continue;
    seen.add(row.id);
    candidates.push({
      albumId: row.id,
      mbid: row.mbid,
      title: row.title,
      artistName: row.artistName,
      releaseYear: row.releaseYear,
      tags: Array.isArray(row.tagNames) ? row.tagNames : [],
      coverUrl: row.coverUrl,
      popularityScore: row.popularityScore,
      hasEmbedding: false,
      sources: ['tag'],
    });
  }
  return candidates;
}

const CATALOG_ANY_FALLBACK_MAX = 100;

/**
 * Last-resort fallback: any album in catalog not in favorites/excluded.
 * Prefer lower popularity (hidden-gem style). Ensures we can generate a drop
 * when the catalog has any albums beyond the user's favorites.
 */
async function getCatalogAnyFallbackCandidates(
  excludedIds: Set<string>,
  suppressedAlbumIds: Set<string>,
  suppressedArtistNames: Set<string>,
  recentArtistCounts: Record<string, number>,
  artistRepeatCapInWindow: number
): Promise<CandidateAlbum[]> {
  if (excludedIds.size === 0) return [];
  const excludedArr = Array.from(excludedIds);
  const placeholders = excludedArr.map((_, i) => `$${i + 1}`).join(',');
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      mbid: string;
      title: string;
      artistName: string;
      releaseYear: number | null;
      coverUrl: string | null;
      popularityScore: number | null;
      tagNames: string[] | null;
    }>
  >(
    `SELECT a."id", a."mbid", a."title", ar."name" AS "artistName",
            a."releaseYear", a."coverUrl", a."popularityScore",
            (SELECT array_agg(t."name") FROM "AlbumTag" at2
             JOIN "Tag" t ON t."id" = at2."tagId" WHERE at2."albumId" = a."id") AS "tagNames"
     FROM "Album" a
     JOIN "Artist" ar ON ar."id" = a."artistId"
     WHERE a."id" NOT IN (${placeholders})
     ORDER BY a."popularityScore" ASC NULLS LAST, a."releaseYear" DESC NULLS LAST
     LIMIT ${CATALOG_ANY_FALLBACK_MAX}`,
    ...excludedArr
  );

  const candidates: CandidateAlbum[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (suppressedAlbumIds.has(normalizeToken(row.id)) || suppressedArtistNames.has(normalizeToken(row.artistName)) || seen.has(row.id)) continue;
    if (isArtistOverRepeatCap(row.artistName, recentArtistCounts, artistRepeatCapInWindow)) continue;
    if (!row.title?.trim() || !row.artistName?.trim()) continue;
    seen.add(row.id);
    candidates.push({
      albumId: row.id,
      mbid: row.mbid,
      title: row.title,
      artistName: row.artistName,
      releaseYear: row.releaseYear,
      tags: Array.isArray(row.tagNames) ? row.tagNames : [],
      coverUrl: row.coverUrl,
      popularityScore: row.popularityScore,
      hasEmbedding: false,
      sources: ['tag'],
    });
  }
  return candidates;
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
  for (const list of Array.from(byArtist.values())) {
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
    suppressedAlbumIds?: string[];
    suppressedArtistNames?: string[];
    suppressedTags?: string[];
    recentArtistCounts?: Record<string, number>;
    artistRepeatCapInWindow?: number;
  }
): Promise<CandidateAlbum[]> {
  const maxCandidates = options?.maxCandidates ?? TARGET_MAX;
  const suppressedAlbumIds = new Set(
    (options?.suppressedAlbumIds ?? []).map((value) => normalizeToken(value)).filter(Boolean)
  );
  const suppressedArtistNames = new Set(
    (options?.suppressedArtistNames ?? []).map((value) => normalizeToken(value)).filter(Boolean)
  );
  const suppressedTags = new Set(
    (options?.suppressedTags ?? []).map((value) => normalizeToken(value)).filter(Boolean)
  );
  const recentArtistCounts = options?.recentArtistCounts ?? {};
  const artistRepeatCapInWindow =
    options?.artistRepeatCapInWindow ??
    FEEDBACK_LOOP_CONFIG.artistRepeatCapInWindow;

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
  const favoriteArtistNames = Array.from(
    new Set(favorites.map((f) => f.artistName).filter(Boolean))
  );

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
  const allTags = Array.from(
    new Set([...tagsFromFavorites, ...userPreferredTags.map((t) => t.toLowerCase())])
  ).slice(0, 8);

  const excludedIds = await getExcludedAlbumIds(userId);

  const [vectorCands, artistCands, tagCands] = await Promise.all([
    getVectorCandidates(favoriteAlbumIds, 60),
    getArtistExpansionCandidates(favoriteArtistNames, 10, 12),
    getTagExpansionCandidates(allTags, 20),
  ]);

  const byDedupeKey = new Map<string, CandidateAlbum>();

  for (const c of vectorCands) {
    if (excludedIds.has(c.albumId)) continue;
    if (suppressedAlbumIds.has(normalizeToken(c.albumId))) continue;
    if (suppressedArtistNames.has(normalizeToken(c.artistName))) continue;
    if (c.tags.some((tag) => suppressedTags.has(normalizeToken(tag)))) continue;
    if (isArtistOverRepeatCap(c.artistName, recentArtistCounts, artistRepeatCapInWindow)) continue;
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
    if (suppressedAlbumIds.has(normalizeToken(c.albumId))) continue;
    if (suppressedArtistNames.has(normalizeToken(c.artistName))) continue;
    if (c.tags.some((tag) => suppressedTags.has(normalizeToken(tag)))) continue;
    if (isArtistOverRepeatCap(c.artistName, recentArtistCounts, artistRepeatCapInWindow)) continue;
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
    if (suppressedAlbumIds.has(normalizeToken(c.albumId))) continue;
    if (suppressedArtistNames.has(normalizeToken(c.artistName))) continue;
    if (c.tags.some((tag) => suppressedTags.has(normalizeToken(tag)))) continue;
    if (isArtistOverRepeatCap(c.artistName, recentArtistCounts, artistRepeatCapInWindow)) continue;
    if (!c.title?.trim() || !c.artistName?.trim()) continue;
    const key = getDedupeKey(c.mbid, c.title, c.artistName, c.releaseYear);
    const existing = byDedupeKey.get(key);
    if (existing) {
      byDedupeKey.set(key, mergeCandidates(existing, c));
    } else {
      byDedupeKey.set(key, toCandidateAlbum(c));
    }
  }

  if (byDedupeKey.size === 0) {
    const fallbackCands = await getCatalogFallbackCandidates(
      userId,
      favoriteAlbumIds,
      excludedIds,
      suppressedAlbumIds,
      suppressedArtistNames,
      recentArtistCounts,
      artistRepeatCapInWindow
    );
    for (const c of fallbackCands) {
      const key = getDedupeKey(c.mbid, c.title, c.artistName, c.releaseYear);
      if (!byDedupeKey.has(key)) byDedupeKey.set(key, c);
    }
    if (fallbackCands.length > 0 && process.env.NODE_ENV !== 'test') {
      console.info('[generateCandidates] catalog same-artist fallback used', { userId, count: fallbackCands.length });
    }
  }
  if (byDedupeKey.size === 0) {
    const tagOverlapCands = await getTagOverlapFallbackCandidates(
      favoriteAlbumIds,
      excludedIds,
      suppressedAlbumIds,
      suppressedArtistNames,
      recentArtistCounts,
      artistRepeatCapInWindow
    );
    for (const c of tagOverlapCands) {
      const key = getDedupeKey(c.mbid, c.title, c.artistName, c.releaseYear);
      if (!byDedupeKey.has(key)) byDedupeKey.set(key, c);
    }
    if (tagOverlapCands.length > 0 && process.env.NODE_ENV !== 'test') {
      console.info('[generateCandidates] catalog tag-overlap fallback used', { userId, count: tagOverlapCands.length });
    }
  }
  if (byDedupeKey.size === 0) {
    const anyCands = await getCatalogAnyFallbackCandidates(
      excludedIds,
      suppressedAlbumIds,
      suppressedArtistNames,
      recentArtistCounts,
      artistRepeatCapInWindow
    );
    for (const c of anyCands) {
      const key = getDedupeKey(c.mbid, c.title, c.artistName, c.releaseYear);
      if (!byDedupeKey.has(key)) byDedupeKey.set(key, c);
    }
    if (anyCands.length > 0 && process.env.NODE_ENV !== 'test') {
      console.info('[generateCandidates] catalog any-album fallback used', { userId, count: anyCands.length });
    }
  }

  let pool = Array.from(byDedupeKey.values());
  pool = applyArtistCap(pool, MAX_ALBUMS_PER_ARTIST);
  pool = pool.slice(0, maxCandidates);

  if (pool.length === 0 && process.env.NODE_ENV !== 'test') {
    console.warn('[generateCandidates] zero candidates after all fallbacks', { userId, favoriteCount: favoriteAlbumIds.length });
  }
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

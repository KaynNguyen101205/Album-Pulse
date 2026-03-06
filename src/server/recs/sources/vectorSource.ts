import { prisma } from '@/lib/prisma';
import { findSimilarAlbums } from '@/server/embeddings/findSimilarAlbums';

export type VectorCandidate = {
  albumId: string;
  mbid: string;
  title: string;
  artistName: string;
  releaseYear: number | null;
  tags: string[];
  coverUrl: string | null;
  popularityScore: number | null;
  hasEmbedding: true;
  fromVector: true;
  fromArtistExpansion: false;
  fromTagExpansion: false;
  rawSignals?: { distance: number };
};

const VECTOR_NEIGHBORS_PER_FAVORITE = 60;

/**
 * Fetches similar albums via pgvector for each favorite album.
 * Returns candidates with provenance fromVector=true.
 */
export async function getVectorCandidates(
  favoriteAlbumIds: string[],
  limitPerFavorite = VECTOR_NEIGHBORS_PER_FAVORITE
): Promise<VectorCandidate[]> {
  const seen = new Set<string>();
  const byId = new Map<string, { distance: number; n: { id: string; mbid: string; title: string; artistName: string } }>();

  for (const albumId of favoriteAlbumIds) {
    const neighbors = await findSimilarAlbums(albumId, limitPerFavorite);

    for (const n of neighbors) {
      if (seen.has(n.id)) continue;
      seen.add(n.id);
      byId.set(n.id, { distance: n.distance, n });
    }
  }

  const ids = Array.from(byId.keys());
  if (ids.length === 0) return [];

  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
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
     WHERE a."id" IN (${placeholders})`,
    ...ids
  );

  const candidates: VectorCandidate[] = [];
  for (const row of rows) {
    const entry = byId.get(row.id);
    if (!entry) continue;
    candidates.push({
      albumId: row.id,
      mbid: row.mbid,
      title: row.title,
      artistName: row.artistName,
      releaseYear: row.releaseYear,
      tags: Array.isArray(row.tagNames) ? row.tagNames : [],
      coverUrl: row.coverUrl,
      popularityScore: row.popularityScore,
      hasEmbedding: true,
      fromVector: true,
      fromArtistExpansion: false,
      fromTagExpansion: false,
      rawSignals: { distance: entry.distance },
    });
  }

  return candidates;
}

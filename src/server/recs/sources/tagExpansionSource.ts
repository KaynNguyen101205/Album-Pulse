import { prisma } from '@/lib/prisma';
import { getTagTopAlbumsWithCache } from '@/server/clients/lastfm';

export type TagExpansionCandidate = {
  albumId: string;
  mbid: string;
  title: string;
  artistName: string;
  releaseYear: number | null;
  tags: string[];
  coverUrl: string | null;
  popularityScore: number | null;
  hasEmbedding: boolean;
  fromVector: false;
  fromArtistExpansion: false;
  fromTagExpansion: true;
  rawSignals?: { tag: string; rank: number };
};

const ALBUMS_PER_TAG = 20;

/**
 * Takes tags → Last.fm tag.getTopAlbums → resolves to DB by mbid.
 * Only returns albums that exist in our catalog.
 */
export async function getTagExpansionCandidates(
  tags: string[],
  albumsPerTag = ALBUMS_PER_TAG
): Promise<TagExpansionCandidate[]> {
  const candidates: TagExpansionCandidate[] = [];
  const seenMbid = new Set<string>();

  for (let tagIdx = 0; tagIdx < tags.length; tagIdx++) {
    const tag = tags[tagIdx].trim().toLowerCase();
    if (!tag) continue;

    const data = await getTagTopAlbumsWithCache(tag, albumsPerTag);
    const albums = data.topalbums?.album ?? [];

    for (let i = 0; i < albums.length; i++) {
      const a = albums[i];
      const mbid = (a.mbid ?? a.artist?.mbid ?? '').trim();
      const title = (a.name ?? '').trim();
      const artistName = (a.artist?.name ?? '').trim();
      if (!mbid || !title || seenMbid.has(mbid)) continue;

      const albumInDb = await prisma.$queryRawUnsafe<
        Array<{
          id: string;
          mbid: string;
          title: string;
          releaseYear: number | null;
          coverUrl: string | null;
          popularityScore: number | null;
          hasEmbedding: boolean;
        }>
      >(
        `SELECT a."id", a."mbid", a."title", a."releaseYear", a."coverUrl", a."popularityScore",
                (SELECT 1 FROM "AlbumEmbedding" e WHERE e."albumId" = a."id" LIMIT 1) IS NOT NULL AS "hasEmbedding"
         FROM "Album" a
         WHERE a."mbid" = $1
         LIMIT 1`,
        mbid
      );

      if (albumInDb.length === 0) continue;
      seenMbid.add(mbid);

      const row = albumInDb[0];
      candidates.push({
        albumId: row.id,
        mbid: row.mbid,
        title: row.title,
        artistName,
        releaseYear: row.releaseYear,
        tags: [tag],
        coverUrl:
          a.image?.find((img) => img.size === 'extralarge')?.['#text'] ??
          a.image?.find((img) => img.size === 'large')?.['#text'] ??
          row.coverUrl,
        popularityScore: row.popularityScore,
        hasEmbedding: row.hasEmbedding,
        fromVector: false,
        fromArtistExpansion: false,
        fromTagExpansion: true,
        rawSignals: { tag, rank: i },
      });
    }
  }

  return candidates;
}

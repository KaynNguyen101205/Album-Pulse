import { prisma } from '@/lib/prisma';
import {
  getSimilarArtistsWithCache,
  getArtistTopAlbumsWithCache,
} from '@/server/clients/lastfm';

export type ArtistExpansionCandidate = {
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
  fromArtistExpansion: true;
  fromTagExpansion: false;
  rawSignals?: { artistRank: number; albumRank: number };
};

const SIMILAR_ARTISTS_LIMIT = 10;
const ALBUMS_PER_ARTIST = 12;

/**
 * Takes favorite artist names → similar artists (Last.fm) → top albums per artist.
 * Resolves albums to DB by mbid; only returns albums that exist in our catalog.
 */
export async function getArtistExpansionCandidates(
  favoriteArtistNames: string[],
  maxSimilarArtists = SIMILAR_ARTISTS_LIMIT,
  albumsPerArtist = ALBUMS_PER_ARTIST
): Promise<ArtistExpansionCandidate[]> {
  const seenArtistNames = new Set(
    favoriteArtistNames.map((n) => n.trim().toLowerCase()).filter(Boolean)
  );
  const similarArtists: { name: string; rank: number }[] = [];

  for (const name of favoriteArtistNames.slice(0, 5)) {
    const data = await getSimilarArtistsWithCache(name, maxSimilarArtists);
    const artists = data.similarartists?.artist ?? [];
    artists.forEach((a, idx) => {
      const n = (a.name ?? '').trim();
      if (!n || seenArtistNames.has(n.toLowerCase())) return;
      seenArtistNames.add(n.toLowerCase());
      similarArtists.push({ name: n, rank: idx });
    });
  }

  const candidates: ArtistExpansionCandidate[] = [];
  const seenMbid = new Set<string>();

  for (const { name: artistName, rank: artistRank } of similarArtists) {
    const data = await getArtistTopAlbumsWithCache(artistName, albumsPerArtist);
    const albums = data.topalbums?.album ?? [];

    for (let i = 0; i < albums.length; i++) {
      const a = albums[i];
      const mbid = (a.mbid ?? a.artist?.mbid ?? '').trim();
      const title = (a.name ?? '').trim();
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
        tags: [],
        coverUrl: row.coverUrl,
        popularityScore: row.popularityScore,
        hasEmbedding: row.hasEmbedding,
        fromVector: false,
        fromArtistExpansion: true,
        fromTagExpansion: false,
        rawSignals: { artistRank, albumRank: i },
      });
    }
  }

  return candidates;
}

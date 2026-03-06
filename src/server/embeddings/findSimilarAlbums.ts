import { prisma } from '@/lib/prisma';

export type SimilarAlbum = {
  id: string;
  mbid: string;
  title: string;
  artistName: string;
  distance: number;
};

export async function findSimilarAlbums(
  albumId: string,
  limit = 10
): Promise<SimilarAlbum[]> {
  const rows = await prisma.$queryRawUnsafe<SimilarAlbum[]>(
    `
    SELECT
      a."id",
      a."mbid",
      a."title",
      ar."name" AS "artistName",
      (e."embedding" <=> q."embedding") AS "distance"
    FROM "AlbumEmbedding" e
    JOIN "Album" a ON a."id" = e."albumId"
    JOIN "Artist" ar ON ar."id" = a."artistId"
    JOIN "AlbumEmbedding" q ON q."albumId" = $1
    WHERE e."albumId" <> $1
    ORDER BY e."embedding" <=> q."embedding"
    LIMIT $2
    `,
    albumId,
    limit
  );

  return rows;
}


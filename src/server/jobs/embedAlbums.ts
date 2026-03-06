import { prisma } from '@/lib/prisma';
import { buildAlbumText } from '@/server/embeddings/buildAlbumText';
import { embedText, getEmbeddingModelVersion } from '@/server/embeddings/embeddingClient';
import type { AlbumDTO } from '@/server/normalizers/albumNormalizer';

const BATCH_SIZE = 50;
const MIN_TEXT_LENGTH = 20;

function toAlbumDTO(album: {
  id: string;
  mbid: string;
  title: string;
  releaseYear: number | null;
  coverUrl: string | null;
  description: string | null;
  popularityListeners: number | null;
  popularityPlaycount: number | null;
  popularityScore: number | null;
  artist: { name: string; mbid: string | null };
  tags: { tag: { name: string } }[];
}): AlbumDTO {
  return {
    mbid: album.mbid,
    title: album.title,
    artistName: album.artist.name,
    artistMbid: album.artist.mbid,
    releaseYear: album.releaseYear,
    tags: album.tags.map((t) => t.tag.name),
    coverUrl: album.coverUrl,
    description: album.description ?? '',
    popularity: {
      listeners: album.popularityListeners,
      playcount: album.popularityPlaycount,
      score: album.popularityScore,
    },
  };
}

async function upsertEmbedding(albumId: string, vector: number[], modelVersion: string) {
  const vectorLiteral = `[${vector.join(',')}]`;

  await prisma.$executeRawUnsafe(
    `
    INSERT INTO "AlbumEmbedding" ("id","albumId","embedding","modelVersion","createdAt")
    VALUES (gen_random_uuid(), $1, $2::vector, $3, NOW())
    ON CONFLICT ("albumId")
    DO UPDATE SET "embedding" = EXCLUDED."embedding",
                  "modelVersion" = EXCLUDED."modelVersion",
                  "createdAt" = NOW()
    `,
    albumId,
    vectorLiteral,
    modelVersion
  );
}

export async function embedAlbums(): Promise<void> {
  const modelVersion = getEmbeddingModelVersion();
  const startedAt = Date.now();
  let processed = 0;
  let skipped = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const albums = await prisma.album.findMany({
      take: BATCH_SIZE,
      where: {
        OR: [
          { embedding: null },
          { embedding: { modelVersion: { not: modelVersion } } },
        ],
      },
      include: {
        artist: true,
        tags: {
          include: { tag: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (albums.length === 0) break;

    for (const album of albums) {
      const dto = toAlbumDTO(album as any);
      const text = buildAlbumText(dto);
      if (!text || text.replace(/\s+/g, '').length < MIN_TEXT_LENGTH) {
        skipped += 1;
        continue;
      }

      try {
        const vector = await embedText(text);
        await upsertEmbedding(album.id, vector, modelVersion);
        processed += 1;
      } catch (err) {
        skipped += 1;
        console.error('[embedAlbums] failed to embed', {
          albumId: album.id,
          error: String(err),
        });
      }
    }
  }

  const durationMs = Date.now() - startedAt;
  console.info('[embedAlbums] done', {
    processed,
    skipped,
    durationMs,
  });
}


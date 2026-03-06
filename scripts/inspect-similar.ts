import 'dotenv/config';
import { prisma } from '@/lib/prisma';
import { findSimilarAlbums } from '@/server/embeddings/findSimilarAlbums';

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    // List sample albums so user can pick a valid id/mbid
    const samples = await prisma.album.findMany({
      take: 10,
      include: { artist: true },
      orderBy: { createdAt: 'desc' },
    });
    if (samples.length === 0) {
      console.error('No albums in DB. Add albums first, then run npm run embed:albums.');
      process.exit(1);
    }
    console.log('Sample albums (use id or mbid):');
    samples.forEach((a) => {
      console.log(`  ${a.id}  |  ${a.mbid}  |  ${a.title} — ${a.artist.name}`);
    });
    console.log('\nUsage: npm run inspect:similar -- <album-id-or-mbid>');
    return;
  }

  const album = await prisma.album.findFirst({
    where: {
      OR: [{ id: arg }, { mbid: arg }],
    },
    include: {
      artist: true,
      tags: { include: { tag: true } },
    },
  });

  if (!album) {
    console.error('Album not found for id/mbid:', arg);
    process.exit(1);
  }

  console.log('Base album:');
  console.log(`- ${album.title} — ${album.artist.name} (${album.releaseYear ?? 'unknown'})`);
  console.log(
    `  tags: ${album.tags.map((t) => t.tag.name).join(', ') || 'none'}`
  );
  console.log('');

  const neighbors = await findSimilarAlbums(album.id, 10);
  if (neighbors.length === 0) {
    console.log('No neighbors found (maybe no embeddings yet).');
    return;
  }

  console.log('Top neighbors:');
  neighbors.forEach((n, idx) => {
    console.log(
      `${idx + 1}. ${n.title} — ${n.artistName} (distance=${n.distance.toFixed(4)})`
    );
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


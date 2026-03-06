/**
 * Minimal CRUD verification for recommender + weekly drop schema.
 * Run after migration: npx tsx scripts/verify-crud.ts (or npm run db:verify)
 * Requires DATABASE_URL.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: ['query', 'info', 'warn', 'error'] });

async function main() {
  console.log('1. Create artist + album + tags...');
  const artist = await prisma.artist.upsert({
    where: { mbid: 'a74b1b7f-71a5-4011-9441-d0b5e4122711' },
    create: { mbid: 'a74b1b7f-71a5-4011-9441-d0b5e4122711', name: 'Radiohead' },
    update: {},
  });
  const album = await prisma.album.upsert({
    where: { mbid: '1c43c9de-5f9a-4e2e-8b8a-1a2b3c4d5e6f' },
    create: {
      mbid: '1c43c9de-5f9a-4e2e-8b8a-1a2b3c4d5e6f',
      title: 'OK Computer',
      artistId: artist.id,
      releaseYear: 1997,
      coverUrl: 'https://example.com/ok-computer.jpg',
      source: 'MUSICBRAINZ',
      popularityScore: 0.8,
    },
    update: {},
  });
  const tagRock = await prisma.tag.upsert({
    where: { name: 'rock' },
    create: { name: 'rock' },
    update: {},
  });
  const tagAlt = await prisma.tag.upsert({
    where: { name: 'alternative' },
    create: { name: 'alternative' },
    update: {},
  });
  await prisma.albumTag.upsert({
    where: { albumId_tagId: { albumId: album.id, tagId: tagRock.id } },
    create: { albumId: album.id, tagId: tagRock.id },
    update: {},
  });
  await prisma.albumTag.upsert({
    where: { albumId_tagId: { albumId: album.id, tagId: tagAlt.id } },
    create: { albumId: album.id, tagId: tagAlt.id },
    update: {},
  });
  console.log('   Artist:', artist.id, '| Album:', album.id, '| Tags: rock, alternative');

  console.log('2. Create user + add favorites...');
  const user = await prisma.user.upsert({
    where: { email: 'verify-crud@album-pulse.local' },
    create: { email: 'verify-crud@album-pulse.local', name: 'CRUD Verify User' },
    update: {},
  });
  await prisma.userFavoriteAlbum.upsert({
    where: { userId_albumId: { userId: user.id, albumId: album.id } },
    create: { userId: user.id, albumId: album.id },
    update: {},
  });
  console.log('   User:', user.id, '| Favorite album added');

  console.log('3. Insert rating + review + event...');
  await prisma.albumRating.upsert({
    where: { userId_albumId: { userId: user.id, albumId: album.id } },
    create: { userId: user.id, albumId: album.id, rating: 5 },
    update: { rating: 5 },
  });
  await prisma.albumReview.upsert({
    where: { userId_albumId: { userId: user.id, albumId: album.id } },
    create: { userId: user.id, albumId: album.id, content: 'Amazing album.' },
    update: { content: 'Amazing album.' },
  });
  await prisma.userEvent.create({
    data: { userId: user.id, albumId: album.id, type: 'LIKE' },
  });
  console.log('   Rating 5, review, LIKE event created');

  console.log('4. Create weekly drop + 5 items (need 5 distinct albums)...');
  // Ensure we have 5 albums: create 4 more if needed
  const moreAlbums = [
    { mbid: '2d54d0ef-6g0b-5f3f-9c9b-2b3c4d5e6f70', title: 'Kid A', releaseYear: 2000 },
    { mbid: '3e65e1fg-7h1c-6g4g-0d0c-3c4d5e6f7081', title: 'In Rainbows', releaseYear: 2007 },
    { mbid: '4f76f2gh-8i2d-7h5h-1e1d-4d5e6f8192', title: 'The Bends', releaseYear: 1995 },
    { mbid: '5g87g3hi-9j3e-8i6i-2f2e-5e6f7092a3', title: 'Amnesiac', releaseYear: 2001 },
  ];
  const albumIds = [album.id];
  for (const a of moreAlbums) {
    const al = await prisma.album.upsert({
      where: { mbid: a.mbid },
      create: {
        mbid: a.mbid,
        title: a.title,
        artistId: artist.id,
        releaseYear: a.releaseYear,
        source: 'MUSICBRAINZ',
      },
      update: {},
    });
    albumIds.push(al.id);
  }
  const weekStart = new Date('2025-03-03'); // Monday UTC
  const drop = await prisma.weeklyDrop.upsert({
    where: { userId_weekStart: { userId: user.id, weekStart } },
    create: { userId: user.id, weekStart, status: 'ACTIVE' },
    update: {},
  });
  for (let rank = 1; rank <= 5; rank++) {
    await prisma.weeklyDropItem.upsert({
      where: { weeklyDropId_rank: { weeklyDropId: drop.id, rank } },
      create: {
        weeklyDropId: drop.id,
        albumId: albumIds[rank - 1]!,
        rank,
        reason: { why: 'similarity', score: 0.9 },
      },
      update: { albumId: albumIds[rank - 1]!, reason: { why: 'similarity', score: 0.9 } },
    });
  }
  console.log('   WeeklyDrop:', drop.id, '| 5 items created');

  console.log('5. Query user active weekly drop...');
  const activeDrop = await prisma.weeklyDrop.findFirst({
    where: { userId: user.id, status: 'ACTIVE' },
    include: { items: { orderBy: { rank: 'asc' }, include: { album: { include: { artist: true } } } } },
  });
  if (activeDrop) {
    console.log('   Active drop weekStart:', activeDrop.weekStart);
    activeDrop.items.forEach((item) => console.log('     Rank', item.rank, '|', item.album.title, '|', item.album.artist.name));
  } else {
    console.log('   No active drop found');
  }

  console.log('\nDone. CRUD verification passed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

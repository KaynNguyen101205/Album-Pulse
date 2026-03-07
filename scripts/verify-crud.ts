/**
 * Minimal CRUD verification for current schema (User, Artist, Album, UserFavoriteAlbum).
 * Run: npm run db:verify
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient({ log: ['query', 'info', 'warn', 'error'] });

const VERIFY_USER_ID = 'verify-user-id';
const VERIFY_ARTIST_MBID = 'verify-artist-mbid';
const VERIFY_ALBUM_MBID = 'verify-album-mbid';

async function main() {
  const user = await prisma.user.upsert({
    where: { id: VERIFY_USER_ID },
    create: {
      id: VERIFY_USER_ID,
      email: 'verify@album-pulse.local',
      name: 'Verify User',
    },
    update: {},
    select: { id: true },
  });

  const artist = await prisma.artist.upsert({
    where: { mbid: VERIFY_ARTIST_MBID },
    create: {
      id: randomUUID(),
      mbid: VERIFY_ARTIST_MBID,
      name: 'Verify Artist',
    },
    update: {},
    select: { id: true },
  });

  const album = await prisma.album.upsert({
    where: { mbid: VERIFY_ALBUM_MBID },
    create: {
      id: randomUUID(),
      mbid: VERIFY_ALBUM_MBID,
      title: 'Verify Album',
      artistId: artist.id,
      releaseYear: 2024,
      source: 'MANUAL',
    },
    update: {},
    select: { id: true },
  });

  await prisma.userFavoriteAlbum.upsert({
    where: {
      userId_albumId: {
        userId: user.id,
        albumId: album.id,
      },
    },
    create: {
      id: randomUUID(),
      userId: user.id,
      albumId: album.id,
    },
    update: {},
  });

  console.log('CRUD verification passed for current schema.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import 'dotenv/config';
import { prisma } from '@/lib/prisma';

const TEST_USER_ID = 'test-user-rec-candidates';
const TEST_USER_EMAIL = 'test-rec@album-pulse.local';
const TEST_USER_NAME = 'Test User (Rec)';

async function main() {
  const albumsWithEmbeddings = await prisma.$queryRawUnsafe<
    Array<{ id: string; mbid: string; title: string }>
  >(
    `SELECT a."id", a."mbid", a."title"
     FROM "Album" a
     JOIN "AlbumEmbedding" e ON e."albumId" = a."id"
     ORDER BY a."createdAt" ASC
     LIMIT 5`
  );

  if (albumsWithEmbeddings.length < 3) {
    console.error(
      'Need at least 3 albums with embeddings. Run: npm run embed:albums'
    );
    process.exit(1);
  }

  // Use only first 3 as favorites so the remaining albums can be vector candidates (neighbors)
  const toFavorite = albumsWithEmbeddings.slice(0, 3);

  await prisma.$executeRawUnsafe(
    `DELETE FROM "UserFavoriteAlbum" WHERE "userId" = $1`,
    TEST_USER_ID
  );

  await prisma.$executeRawUnsafe(
    `INSERT INTO "User" ("id", "email", "name", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, NOW(), NOW())
     ON CONFLICT ("id") DO NOTHING`,
    TEST_USER_ID,
    TEST_USER_EMAIL,
    TEST_USER_NAME
  );

  for (const album of toFavorite) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "UserFavoriteAlbum" ("id", "userId", "albumId", "addedAt")
       VALUES (gen_random_uuid()::text, $1, $2, NOW())
       ON CONFLICT ("userId", "albumId") DO NOTHING`,
      TEST_USER_ID,
      album.id
    );
  }

  const count = await prisma.$queryRawUnsafe<[{ count: string }]>(
    `SELECT COUNT(*)::text AS count FROM "UserFavoriteAlbum" WHERE "userId" = $1`,
    TEST_USER_ID
  );

  console.log('Created test user:');
  console.log(`  userId: ${TEST_USER_ID}`);
  console.log(`  email:  ${TEST_USER_EMAIL}`);
  console.log(`  favorites: ${count[0].count}`);
  console.log('\nTest with:');
  console.log(
    `  curl -X POST http://localhost:3000/api/recs/candidates -H "Content-Type: application/json" -d '{"userId":"${TEST_USER_ID}"}'`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

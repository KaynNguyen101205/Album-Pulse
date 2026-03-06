import 'dotenv/config';
import { prisma } from '@/lib/prisma';

async function main() {
  const users = await prisma.$queryRawUnsafe<
    Array<{ id: string; email: string | null; name: string | null; favoriteCount: number }>
  >(
    `SELECT u."id", u."email", u."name",
            (SELECT COUNT(*)::int FROM "UserFavoriteAlbum" ufa WHERE ufa."userId" = u."id") AS "favoriteCount"
     FROM "User" u
     ORDER BY "favoriteCount" DESC`
  );

  if (users.length === 0) {
    console.log('No users in DB. Create users and add favorites first.');
    return;
  }

  console.log('Users (id, email, name, favorites):');
  users.forEach((u) => {
    console.log(`  ${u.id}  |  ${u.email ?? '-'}  |  ${u.name ?? '-'}  |  ${u.favoriteCount} favs`);
  });
  console.log('\nUse a userId with >= 3 favorites for: POST /api/recs/candidates');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

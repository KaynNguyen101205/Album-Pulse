/**
 * Test recommendation flow: find a user with 3+ favorites, run weekly drop
 * generation, and report whether recommendations were produced.
 *
 * Usage:
 *   npx tsx scripts/test-recommendation-flow.ts
 *   USER_ID=clxxx npx tsx scripts/test-recommendation-flow.ts   # specific user
 *
 * Requires: DATABASE_URL in .env
 */
import 'dotenv/config';
import { prisma } from '@/lib/prisma';
import { generateWeeklyDropForUser } from '@/server/services/generateWeeklyDrop';

const MIN_FAVORITES = 3;

async function main() {
  const userIdFromEnv = process.env.USER_ID?.trim();

  let userId: string;
  let favoriteCount: number;

  if (userIdFromEnv) {
    const count = await prisma.userFavoriteAlbum.count({
      where: { userId: userIdFromEnv },
    });
    if (count === 0) {
      console.error('USER_ID has no favorites.');
      process.exit(1);
    }
    userId = userIdFromEnv;
    favoriteCount = count;
  } else {
    const users = await prisma.$queryRawUnsafe<
      Array<{ id: string; cnt: number }>
    >(
      `SELECT u."id", COUNT(ufa."albumId")::int AS cnt
       FROM "User" u
       JOIN "UserFavoriteAlbum" ufa ON ufa."userId" = u."id"
       GROUP BY u."id"
       HAVING COUNT(ufa."albumId") >= $1
       ORDER BY cnt DESC
       LIMIT 1`,
      MIN_FAVORITES
    );
    if (users.length === 0) {
      console.log('No user with >= 3 favorites found. Add favorites first (onboarding or /favorites/add).');
      process.exit(0);
    }
    userId = users[0].id;
    favoriteCount = users[0].cnt;
  }

  console.log('Recommendation flow test');
  console.log('  userId:', userId);
  console.log('  favoriteCount:', favoriteCount);
  console.log('');

  const result = await generateWeeklyDropForUser(userId);

  if (result.ok === false) {
    console.log('Result: FAIL');
    console.log('  error:', result.error);
    if (result.error === 'no_candidates') {
      console.log('  → Catalog fallback may not have found same-artist albums in DB, or vector/artist/tag sources returned nothing.');
    }
    process.exit(1);
  }

  console.log('Result: OK');
  console.log('  weeklyDropId:', result.weeklyDropId);
  console.log('  weekKey:', result.weekKey);
  console.log('  generated:', result.generated);
  if (result.generated === false && 'reason' in result) {
    console.log('  reason:', result.reason);
  }

  const itemCount = await prisma.weeklyDropItem.count({
    where: { weeklyDropId: result.weeklyDropId },
  });
  console.log('  itemCount:', itemCount);

  if (itemCount >= 1) {
    console.log('');
    console.log('Recommendation flow is working: weekly drop has', itemCount, 'items.');
  } else {
    console.log('');
    console.log('Warning: weekly drop has 0 items. Check ranking or RECOMMENDATIONS_COUNT.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

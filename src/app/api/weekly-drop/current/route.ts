import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/session';
import {
  NotLoggedInError,
  getCurrentWeeklyDrop,
} from '@/server/services/weekly-drop.service';
import { generateWeeklyDropForUser } from '@/server/services/generateWeeklyDrop';
import { unauthorized, internalError } from '@/lib/api/errors';

const MIN_FAVORITES_FOR_DROP = 3;

export const dynamic = 'force-dynamic';

/**
 * GET /api/weekly-drop/current
 * Returns the current week's weekly drop for the authenticated user.
 * If no drop exists and user has 3+ favorites, triggers on-demand generation and retries.
 */
export async function GET() {
  try {
    const auth = await requireSession();
    if (auth instanceof NextResponse) return auth;
    const userId = auth;

    let drop = await getCurrentWeeklyDrop();
    let favoriteCount: number | null = null;

    if (!drop || drop.items.length === 0) {
      favoriteCount = await prisma.userFavoriteAlbum.count({
        where: { userId },
      });
      console.info('[api/weekly-drop/current] no drop', { userId, favoriteCount });
      if (favoriteCount >= MIN_FAVORITES_FOR_DROP) {
        const result = await generateWeeklyDropForUser(userId);
        console.info('[api/weekly-drop/current] generation result', { userId, ok: result.ok, generated: result.ok && 'generated' in result ? result.generated : null, error: result.ok === false ? result.error : null });
        if (result.ok && result.generated) {
          drop = await getCurrentWeeklyDrop();
        }
      }
    }

    if (!drop || drop.items.length === 0) {
      if (favoriteCount === null) {
        favoriteCount = await prisma.userFavoriteAlbum.count({
          where: { userId },
        });
      }
      return NextResponse.json({
        ok: true,
        drop: null,
        hasFavorites: favoriteCount >= MIN_FAVORITES_FOR_DROP,
      });
    }

    return NextResponse.json({ ok: true, drop, hasFavorites: true });
  } catch (error) {
    if (error instanceof NotLoggedInError) {
      return unauthorized();
    }
    console.error('[api/weekly-drop/current]', error);
    return internalError();
  }
}

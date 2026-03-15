import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/session';
import {
  getCurrentWeeklyDrop,
  NotLoggedInError,
} from '@/server/services/weekly-drop.service';
import { generateWeeklyDropForUser } from '@/server/services/generateWeeklyDrop';
import { unauthorized, internalError } from '@/lib/api/errors';

const MIN_FAVORITES_FOR_DROP = 3;

/**
 * GET /api/albums/suggest
 * Returns album-based suggestions for the dashboard (no Spotify).
 * Uses the current week's Weekly Drop when available.
 * If no drop exists but the user has 3+ favorites, triggers generation once and retries.
 */
export async function GET() {
  try {
    const auth = await requireSession();
    if (auth instanceof NextResponse) return auth;
    const userId = auth;

    let drop = await getCurrentWeeklyDrop();
    if (!drop || drop.items.length === 0) {
      const favoriteCount = await prisma.userFavoriteAlbum.count({
        where: { userId },
      });
      if (favoriteCount >= MIN_FAVORITES_FOR_DROP) {
        const result = await generateWeeklyDropForUser(userId);
        if (result.ok && result.generated) {
          drop = await getCurrentWeeklyDrop();
        }
      }
    }
    if (!drop || drop.items.length === 0) {
      return NextResponse.json({
        ok: true,
        dotGoiYId: null,
        items: [],
      });
    }

    const albumIds = drop.items.map((item) => item.album.id);
    const albums = await prisma.album.findMany({
      where: { id: { in: albumIds } },
      select: { id: true, mbid: true },
    });
    const mbidByAlbumId = new Map(albums.map((a) => [a.id, a.mbid]));

    const items = drop.items.map((item, index) => ({
      score: 1,
      diem: 1,
      viTri: item.rank,
      lyDo: item.whyRecommended,
      reason: item.whyRecommended,
      album: {
        id: item.album.id,
        spotifyId: mbidByAlbumId.get(item.album.id) ?? item.album.id,
        name: item.album.title,
        ten: item.album.title,
        artistName: item.album.artistName,
        anhBiaUrl: item.album.coverUrl,
        releaseDate: item.album.releaseYear != null ? String(item.album.releaseYear) : null,
        ngayPhatHanh: item.album.releaseYear != null ? String(item.album.releaseYear) : null,
        spotifyUrl: null,
      },
    }));

    return NextResponse.json({
      ok: true,
      dotGoiYId: drop.id,
      items,
    });
  } catch (error) {
    if (error instanceof NotLoggedInError) {
      return unauthorized();
    }
    console.error('[api/albums/suggest]', error);
    return internalError();
  }
}

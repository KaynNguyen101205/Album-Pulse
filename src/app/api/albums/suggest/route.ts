import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getCurrentWeeklyDrop,
  NotLoggedInError,
} from '@/server/services/weekly-drop.service';
import { unauthorized, internalError } from '@/lib/api/errors';

/**
 * GET /api/albums/suggest
 * Returns album-based suggestions for the dashboard (no Spotify).
 * Uses the current week's Weekly Drop when available; otherwise returns empty.
 * timeRange query param is accepted for backward compatibility but ignored.
 */
export async function GET() {
  try {
    const drop = await getCurrentWeeklyDrop();
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

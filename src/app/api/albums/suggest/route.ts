import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/session';
import { generateCandidatesForUser } from '@/server/recs/candidateGenerator';
import { getRankingContextForUser } from '@/server/recs/getRankingContext';
import {
  buildRecommendations,
  scoreCandidates,
  selectTopN,
} from '@/server/recs/scoring/rankAlbums';
import { NotLoggedInError } from '@/server/services/weekly-drop.service';
import { unauthorized, internalError } from '@/lib/api/errors';

const MIN_FAVORITES_FOR_DROP = 3;
const DASHBOARD_RECOMMENDATIONS_COUNT = 18;

export const dynamic = 'force-dynamic';

/**
 * GET /api/albums/suggest
 * Returns album-based suggestions for the dashboard (no Spotify).
 * Computes a recommendation list separate from the current Weekly Drop.
 */
export async function GET() {
  try {
    const auth = await requireSession();
    if (auth instanceof NextResponse) return auth;
    const userId = auth;

    const context = await getRankingContextForUser(userId);
    const candidates = await generateCandidatesForUser(userId, {
      suppressedAlbumIds: Object.keys(context.suppressionByAlbum ?? {}),
      suppressedArtistNames: Object.keys(context.suppressionByArtist ?? {}),
      suppressedTags: Object.keys(context.suppressionByTag ?? {}),
      recentArtistCounts: context.recentArtistCounts ?? {},
    });

    if (candidates.length === 0) {
      const favoriteCount = await prisma.userFavoriteAlbum.count({
        where: { userId },
      });
      const hasFavorites = favoriteCount >= MIN_FAVORITES_FOR_DROP;
      console.info('[api/albums/suggest] no candidates', { userId, favoriteCount, hasFavorites });
      return NextResponse.json({
        ok: true,
        dotGoiYId: null,
        items: [],
        hasFavorites,
      });
    }

    const scored = scoreCandidates(candidates, context);
    const selected = selectTopN(
      scored,
      Math.min(DASHBOARD_RECOMMENDATIONS_COUNT, candidates.length)
    );
    const recommendations = buildRecommendations(selected);

    if (recommendations.length === 0) {
      const favoriteCount = await prisma.userFavoriteAlbum.count({
        where: { userId },
      });
      return NextResponse.json({
        ok: true,
        dotGoiYId: null,
        items: [],
        hasFavorites: favoriteCount >= MIN_FAVORITES_FOR_DROP,
      });
    }

    const items = recommendations.map((item) => ({
      score: item.score,
      diem: item.score,
      viTri: item.rank,
      lyDo: item.explanation.short,
      reason: item.explanation.short,
      album: {
        id: item.albumId,
        spotifyId: item.mbid || item.albumId,
        name: item.title,
        ten: item.title,
        artistName: item.artistName,
        anhBiaUrl: item.coverUrl,
        releaseDate: item.releaseYear != null ? String(item.releaseYear) : null,
        ngayPhatHanh: item.releaseYear != null ? String(item.releaseYear) : null,
        spotifyUrl: null,
      },
    }));

    return NextResponse.json({
      ok: true,
      dotGoiYId: null,
      items,
      hasFavorites: true,
    });
  } catch (error) {
    if (error instanceof NotLoggedInError) {
      return unauthorized();
    }
    console.error('[api/albums/suggest]', error);
    return internalError();
  }
}

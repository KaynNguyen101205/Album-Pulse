import { NextResponse } from 'next/server';
import {
  getValidAccessToken,
  fetchTopArtists,
  fetchRecentlyPlayed,
  NotLoggedInError,
} from '@/server/services/spotify.service';
import { SpotifyApiError } from '@/lib/spotify/types';

export async function GET() {
  try {
    const accessToken = await getValidAccessToken();

    const [top, recent] = await Promise.all([
      fetchTopArtists(accessToken, 'medium_term'),
      fetchRecentlyPlayed(accessToken, 50),
    ]);

    return NextResponse.json({ ok: true, topArtists: top, recentPlays: recent });
  } catch (err) {
    if (err instanceof NotLoggedInError) {
      return NextResponse.json({ error: 'not_logged_in' }, { status: 401 });
    }

    if (err instanceof SpotifyApiError) {
      return NextResponse.json(
        { error: err.code, status: err.status, details: err.details },
        { status: err.status }
      );
    }

    return NextResponse.json({ error: 'unexpected', message: String(err) }, { status: 500 });
  }
}
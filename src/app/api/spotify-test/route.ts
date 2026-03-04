import { NextResponse } from 'next/server';
import { spotifyGetWithAuth, NotLoggedInError } from '@/server/services/spotify.service';
import { SpotifyApiError } from '@/lib/spotify/types';

export async function GET() {
  try {
    const me = await spotifyGetWithAuth<any>('/me');
    return NextResponse.json({ ok: true, me });
  } catch (err) {
    if (err instanceof NotLoggedInError) {
      return NextResponse.json({ error: 'not_logged_in' }, { status: 401 });
    }

    if (err instanceof SpotifyApiError) {
      if (err.code === 'rate_limited') {
        return NextResponse.json(
          { error: 'rate_limited', retryAfterSeconds: err.retryAfterSeconds ?? null },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: err.code, status: err.status, details: err.details },
        { status: err.status }
      );
    }

    return NextResponse.json({ error: 'unexpected', message: String(err) }, { status: 500 });
  }
}
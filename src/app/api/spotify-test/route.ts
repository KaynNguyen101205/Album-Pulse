import { NextResponse } from 'next/server';
import { spotifyGet } from '@/lib/spotify/client';
import { SpotifyApiError } from '@/lib/spotify/types';

export async function GET() {
  // TODO: replace with a real access token from your DB/session
  const accessToken = 'invalid-token';

  try {
    const me = await spotifyGet<any>('/me', accessToken);
    return NextResponse.json({ ok: true, me });
  } catch (err) {
    if (err instanceof SpotifyApiError) {
      return NextResponse.json(
        { code: err.code, status: err.status, details: err.details },
        { status: err.status }
      );
    }
    return NextResponse.json({ error: 'unexpected', message: String(err) }, { status: 500 });
  }
}
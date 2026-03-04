import { NextResponse } from 'next/server';
import { SpotifyApiError } from '@/lib/spotify/types';
import { generateAndPersistRecommendations } from '@/server/services/recommend.service';
import { NotLoggedInError } from '@/server/services/spotify.service';

export async function GET() {
  try {
    const result = await generateAndPersistRecommendations();

    return NextResponse.json({
      ok: true,
      dotGoiYId: result.dotGoiYId,
      items: result.items,
    });
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

import { TimeRangeSpotify } from '@prisma/client';
import { NextResponse } from 'next/server';
import { SpotifyApiError } from '@/lib/spotify/types';
import { generateAndPersistRecommendations } from '@/server/services/recommend.service';
import { NotLoggedInError } from '@/server/services/spotify.service';

function parseTimeRange(value: string | null): TimeRangeSpotify | null | 'invalid' {
  if (value === null || value.trim() === '') return null;

  const normalized = value.trim().toLowerCase();
  if (normalized === 'short_term' || normalized === 'short') return TimeRangeSpotify.SHORT_TERM;
  if (normalized === 'medium_term' || normalized === 'medium') return TimeRangeSpotify.MEDIUM_TERM;
  if (normalized === 'long_term' || normalized === 'long') return TimeRangeSpotify.LONG_TERM;
  return 'invalid';
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsedTimeRange = parseTimeRange(searchParams.get('timeRange'));

    if (parsedTimeRange === 'invalid') {
      return NextResponse.json(
        {
          error: 'invalid_time_range',
          message: 'timeRange must be short_term, medium_term, or long_term',
        },
        { status: 400 }
      );
    }

    const result = await generateAndPersistRecommendations(
      parsedTimeRange ? { timeRange: parsedTimeRange } : {}
    );

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

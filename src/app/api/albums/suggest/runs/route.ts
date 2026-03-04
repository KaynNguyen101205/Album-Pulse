import { NextResponse } from 'next/server';

import {
  getRecommendationRunsHistory,
  InvalidCursorError,
} from '@/server/services/recommend.service';
import { NotLoggedInError } from '@/server/services/spotify.service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const cursor = searchParams.get('cursor');

    const limit =
      limitParam === null || limitParam.trim() === '' ? undefined : Number.parseInt(limitParam, 10);

    const result = await getRecommendationRunsHistory({
      limit,
      cursor,
    });

    return NextResponse.json({
      ok: true,
      runs: result.runs,
      nextCursor: result.nextCursor,
    });
  } catch (err) {
    if (err instanceof NotLoggedInError) {
      return NextResponse.json({ error: 'not_logged_in' }, { status: 401 });
    }

    if (err instanceof InvalidCursorError) {
      return NextResponse.json({ error: 'invalid_cursor' }, { status: 400 });
    }

    return NextResponse.json({ error: 'unexpected', message: String(err) }, { status: 500 });
  }
}

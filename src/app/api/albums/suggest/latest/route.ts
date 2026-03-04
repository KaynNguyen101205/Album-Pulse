import { NextResponse } from 'next/server';

import { getLatestRecommendationRun } from '@/server/services/recommend.service';
import { NotLoggedInError } from '@/server/services/spotify.service';

export async function GET() {
  try {
    const latest = await getLatestRecommendationRun();

    return NextResponse.json({
      ok: true,
      run: latest?.run ?? null,
      items: latest?.items ?? [],
    });
  } catch (err) {
    if (err instanceof NotLoggedInError) {
      return NextResponse.json({ error: 'not_logged_in' }, { status: 401 });
    }

    return NextResponse.json({ error: 'unexpected', message: String(err) }, { status: 500 });
  }
}

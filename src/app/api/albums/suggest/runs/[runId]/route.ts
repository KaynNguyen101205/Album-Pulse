import { NextResponse } from 'next/server';

import {
  getRecommendationRunById,
  RecommendationRunNotFoundError,
} from '@/server/services/recommend.service';
import { NotLoggedInError } from '@/server/services/spotify.service';

export async function GET(_request: Request, context: { params: { runId: string } }) {
  try {
    const result = await getRecommendationRunById(context.params.runId);

    return NextResponse.json({
      ok: true,
      run: result.run,
      items: result.items,
    });
  } catch (err) {
    if (err instanceof NotLoggedInError) {
      return NextResponse.json({ error: 'not_logged_in' }, { status: 401 });
    }

    if (err instanceof RecommendationRunNotFoundError) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    return NextResponse.json({ error: 'unexpected', message: String(err) }, { status: 500 });
  }
}

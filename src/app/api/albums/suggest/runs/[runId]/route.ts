import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';

/**
 * GET /api/albums/suggest/runs/[runId]
 * Legacy endpoint; no longer uses Spotify. Returns 404.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ runId: string }> | { runId: string } }
) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const params =
    typeof context.params === 'object' && 'then' in context.params
      ? await context.params
      : context.params;
  void params.runId;
  return NextResponse.json({ error: 'not_found' }, { status: 404 });
}

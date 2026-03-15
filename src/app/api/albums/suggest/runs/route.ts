import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';

/**
 * GET /api/albums/suggest/runs
 * Legacy endpoint; no longer uses Spotify. Returns empty list.
 */
export async function GET() {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json({
    ok: true,
    runs: [],
    nextCursor: null,
  });
}

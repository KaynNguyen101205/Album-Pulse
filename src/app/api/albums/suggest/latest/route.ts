import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';

/**
 * GET /api/albums/suggest/latest
 * Legacy endpoint; no longer uses Spotify. Returns empty run.
 */
export async function GET() {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json({
    ok: true,
    run: null,
    items: [],
  });
}

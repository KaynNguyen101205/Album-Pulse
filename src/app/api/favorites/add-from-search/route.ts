import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { addSingleAlbumToFavorites } from '@/server/services/onboardingFavorites.service';

function toOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toOptionalYear(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const year = Math.floor(value);
  return year >= 1000 && year <= 9999 ? year : null;
}

/**
 * POST /api/favorites/add-from-search
 * Body: { mbid?, title, artistName, artistMbid?, releaseYear?, coverUrl? }
 * Ensures the album is in the catalog (from MusicBrainz if mbid provided) and adds it to the user's favorites.
 */
export async function POST(request: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'bad_request', message: 'Invalid JSON.' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'bad_request', message: 'Body must be an object.' }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const title = toOptionalString(o.title);
  const artistName = toOptionalString(o.artistName);
  if (!title || !artistName) {
    return NextResponse.json(
      { error: 'validation_error', message: 'title and artistName are required.' },
      { status: 400 }
    );
  }

  const mbid = toOptionalString(o.mbid);
  const artistMbid = toOptionalString(o.artistMbid);
  const releaseYear = toOptionalYear(o.releaseYear);
  const coverUrl = toOptionalString(o.coverUrl);

  try {
    const result = await addSingleAlbumToFavorites(userId, {
      mbid: mbid ?? null,
      title,
      artistName,
      artistMbid: artistMbid ?? null,
      releaseYear,
      coverUrl: coverUrl ?? null,
    });
    return NextResponse.json({ ok: true, albumId: result.albumId, added: result.added });
  } catch (err) {
    const isUniqueViolation =
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === 'P2002';
    if (isUniqueViolation) {
      return NextResponse.json({ ok: true, added: false, message: 'Already in favorites.' });
    }
    const message = err instanceof Error ? err.message : 'Failed to add album to favorites.';
    if (message.includes('not found')) {
      return NextResponse.json({ error: 'album_not_found', message }, { status: 404 });
    }
    console.error('[api/favorites/add-from-search]', err);
    return NextResponse.json({ error: 'server_error', message }, { status: 500 });
  }
}

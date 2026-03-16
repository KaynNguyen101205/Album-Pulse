import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/session';

/**
 * Resolve request album identifier to DB mbid.
 * Accepts raw MusicBrainz MBIDs, mb:xxx, manual:xxx, spotify:xxx, or legacy Spotify ids.
 */
function toAlbumLookupValues(albumSpotifyId: string): string[] {
  const trimmed = albumSpotifyId.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('mb:')) {
    return [trimmed.slice(3)].filter(Boolean);
  }

  if (trimmed.startsWith('manual:') || trimmed.startsWith('spotify:')) {
    return [trimmed];
  }

  return [trimmed, `spotify:${trimmed}`];
}

async function findAlbumByIdentifier(albumSpotifyId: string) {
  const lookupValues = toAlbumLookupValues(albumSpotifyId);
  for (const mbid of lookupValues) {
    const album = await prisma.album.findUnique({
      where: { mbid },
    });
    if (album) return album;
  }
  return null;
}

export async function GET() {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;
  const nguoiDungId = auth;

  const favorites = await prisma.userFavoriteAlbum.findMany({
    where: { userId: nguoiDungId },
    orderBy: { addedAt: 'desc' },
    include: {
      album: {
        select: { mbid: true, title: true, coverUrl: true },
      },
    },
  });

  const items = favorites.map((f) => ({
    spotifyId: f.album.mbid.startsWith('spotify:')
      ? f.album.mbid.slice('spotify:'.length)
      : f.album.mbid,
    ten: f.album.title,
    anhBiaUrl: f.album.coverUrl,
  }));

  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;
  const nguoiDungId = auth;

  let body: { albumSpotifyId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const rawId = typeof body?.albumSpotifyId === 'string' ? body.albumSpotifyId.trim() : '';
  if (!rawId) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const album = await findAlbumByIdentifier(rawId);

  if (!album) {
    return NextResponse.json(
      {
        error: 'album_not_found',
        message: 'Album not in catalog. Add albums via onboarding or search.',
      },
      { status: 400 }
    );
  }

  try {
    await prisma.userFavoriteAlbum.create({
      data: { id: randomUUID(), userId: nguoiDungId, albumId: album.id },
    });
  } catch (e: unknown) {
    const isUniqueViolation =
      e &&
      typeof e === 'object' &&
      'code' in e &&
      (e as { code: string }).code === 'P2002';
    if (!isUniqueViolation) throw e;
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;
  const nguoiDungId = auth;

  const { searchParams } = new URL(request.url);
  const rawId = searchParams.get('albumSpotifyId')?.trim() ?? '';
  if (!rawId) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const album = await findAlbumByIdentifier(rawId);

  if (album) {
    try {
      await prisma.userFavoriteAlbum.deleteMany({
        where: { userId: nguoiDungId, albumId: album.id },
      });
    } catch (e: unknown) {
      const isNotFound =
        e &&
        typeof e === 'object' &&
        'code' in e &&
        (e as { code: string }).code === 'P2025';
      if (!isNotFound) throw e;
    }
  }

  return NextResponse.json({ ok: true });
}

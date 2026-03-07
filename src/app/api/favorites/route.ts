import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/session';
import { getValidAccessToken, fetchAlbumById, pickBestAlbumImageUrl, NotLoggedInError } from '@/server/services/spotify.service';
import { SpotifyApiError } from '@/lib/spotify/types';

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
    spotifyId: f.album.mbid.startsWith('spotify:') ? f.album.mbid.slice('spotify:'.length) : f.album.mbid,
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

  const albumSpotifyId = typeof body?.albumSpotifyId === 'string' ? body.albumSpotifyId.trim() : '';
  if (!albumSpotifyId) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const albumMbid = `spotify:${albumSpotifyId}`;
  let album = await prisma.album.findUnique({
    where: { mbid: albumMbid },
  });

  if (!album) {
    try {
      const accessToken = await getValidAccessToken();
      const spAlbum = await fetchAlbumById(accessToken, albumSpotifyId);

      const coverUrl = pickBestAlbumImageUrl(spAlbum.images) ?? null;
      const releaseYearRaw = Number.parseInt((spAlbum.release_date ?? '').slice(0, 4), 10);
      const releaseYear = Number.isFinite(releaseYearRaw) ? releaseYearRaw : null;
      const primaryArtist = spAlbum.artists?.[0];
      const artistId = `spotify:${primaryArtist?.id ?? 'unknown-artist'}`;
      const artist = await prisma.artist.upsert({
        where: { id: artistId },
        create: {
          id: artistId,
          mbid: primaryArtist?.id ? `spotify:${primaryArtist.id}` : null,
          name: primaryArtist?.name ?? 'Unknown artist',
        },
        update: {
          name: primaryArtist?.name ?? 'Unknown artist',
          ...(primaryArtist?.id ? { mbid: `spotify:${primaryArtist.id}` } : {}),
        },
      });

      album = await prisma.album.create({
        data: {
          id: randomUUID(),
          mbid: albumMbid,
          title: spAlbum.name,
          artistId: artist.id,
          releaseYear,
          coverUrl,
          source: 'MANUAL',
        },
      });
    } catch (err) {
      if (err instanceof NotLoggedInError) {
        return NextResponse.json({ error: 'not_logged_in' }, { status: 401 });
      }
      if (err instanceof SpotifyApiError) {
        if (err.code === 'rate_limited') {
          return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
        }
        if (err.code === 'unauthorized') {
          return NextResponse.json({ error: 'not_logged_in' }, { status: 401 });
        }
      }
      return NextResponse.json({ error: 'internal_error' }, { status: 500 });
    }
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
  const albumSpotifyId = searchParams.get('albumSpotifyId')?.trim() ?? '';
  if (!albumSpotifyId) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const albumMbid = `spotify:${albumSpotifyId}`;
  const album = await prisma.album.findUnique({
    where: { mbid: albumMbid },
  });

  if (album) {
    try {
      await prisma.userFavoriteAlbum.deleteMany({ where: { userId: nguoiDungId, albumId: album.id } });
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

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/session';
import { getValidAccessToken, fetchAlbumById, pickBestAlbumImageUrl, NotLoggedInError } from '@/server/services/spotify.service';
import { SpotifyApiError } from '@/lib/spotify/types';

export async function GET() {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;
  const nguoiDungId = auth;

  const favorites = await prisma.yeuThichAlbum.findMany({
    where: { nguoiDungId },
    orderBy: { createdAt: 'desc' },
    include: {
      album: {
        select: { spotifyId: true, ten: true, anhBiaUrl: true },
      },
    },
  });

  const items = favorites.map((f) => ({
    spotifyId: f.album.spotifyId,
    ten: f.album.ten,
    anhBiaUrl: f.album.anhBiaUrl,
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

  let album = await prisma.album.findUnique({
    where: { spotifyId: albumSpotifyId },
  });

  if (!album) {
    try {
      const accessToken = await getValidAccessToken();
      const spAlbum = await fetchAlbumById(accessToken, albumSpotifyId);

      const anhBiaUrl = pickBestAlbumImageUrl(spAlbum.images) ?? null;
      const spotifyUrl = spAlbum.external_urls?.spotify ?? null;
      const ngayPhatHanh = spAlbum.release_date ?? null;

      album = await prisma.album.create({
        data: {
          spotifyId: spAlbum.id,
          ten: spAlbum.name,
          ngayPhatHanh,
          anhBiaUrl,
          spotifyUrl,
          uri: spAlbum.uri ?? null,
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
    await prisma.yeuThichAlbum.create({
      data: { nguoiDungId, albumId: album.id },
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

  const album = await prisma.album.findUnique({
    where: { spotifyId: albumSpotifyId },
  });

  if (album) {
    try {
      await prisma.yeuThichAlbum.delete({
        where: {
          nguoiDungId_albumId: { nguoiDungId, albumId: album.id },
        },
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

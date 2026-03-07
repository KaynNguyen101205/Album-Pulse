import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/session';

const MINIMUM_ALBUMS = 3;

export async function GET() {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;
  const nguoiDungId = auth;

  const [user, selectedAlbumCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: nguoiDungId },
      select: { id: true },
    }),
    prisma.userFavoriteAlbum.count({
      where: { userId: nguoiDungId },
    }),
  ]);

  if (!user) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    isComplete: selectedAlbumCount >= MINIMUM_ALBUMS,
    selectedAlbumCount,
    minimumAlbums: MINIMUM_ALBUMS,
  });
}

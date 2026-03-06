import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/session';

const MINIMUM_ALBUMS = 3;

export async function GET() {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;
  const nguoiDungId = auth;

  const [user, selectedAlbumCount] = await Promise.all([
    prisma.nguoiDung.findUnique({
      where: { id: nguoiDungId },
      select: { onboardingCompletedAt: true },
    }),
    prisma.yeuThichAlbum.count({
      where: { nguoiDungId },
    }),
  ]);

  if (!user) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    isComplete: Boolean(user.onboardingCompletedAt),
    selectedAlbumCount,
    minimumAlbums: MINIMUM_ALBUMS,
  });
}

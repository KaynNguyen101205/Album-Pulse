import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { findSimilarAlbums } from '@/server/embeddings/findSimilarAlbums';

type ErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: unknown
) {
  const body: ErrorBody = {
    error: { code, message, ...(details ? { details } : {}) },
  };
  return NextResponse.json(body, { status });
}

type RouteParams = {
  params: { id: string };
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  const id = params.id?.trim();
  if (!id) {
    return errorResponse(400, 'bad_request', 'Missing album id in path.');
  }

  const limitParam = request.nextUrl.searchParams.get('limit');
  const limit = (() => {
    const n = limitParam ? Number(limitParam) : 10;
    if (!Number.isFinite(n) || n <= 0) return 10;
    return Math.min(50, n);
  })();

  const exists = await prisma.album.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!exists) {
    return errorResponse(404, 'not_found', 'Album not found.');
  }

  try {
    const similar = await findSimilarAlbums(id, limit);
    return NextResponse.json({
      albumId: id,
      similar,
      meta: { count: similar.length },
    });
  } catch (err) {
    console.error('[api/albums/[id]/similar] unexpected_error', err);
    return errorResponse(500, 'internal_error', 'Unexpected server error.');
  }
}


import { NextRequest, NextResponse } from 'next/server';

import { getTagTopAlbumsWithCache } from '@/server/clients/lastfm';
import { UpstreamError } from '@/server/clients/http';

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
  params: { tag: string };
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  const tag = params.tag?.trim();
  if (!tag) {
    return errorResponse(400, 'bad_request', 'Missing tag in path.');
  }

  const limitParam = request.nextUrl.searchParams.get('limit');
  const limit = (() => {
    const n = limitParam ? Number(limitParam) : 20;
    if (!Number.isFinite(n) || n <= 0) return 20;
    return Math.min(50, n);
  })();

  try {
    const data = await getTagTopAlbumsWithCache(tag, limit);
    const albumsRaw = data.topalbums?.album ?? [];

    const albums = albumsRaw.map((a) => {
      const name = a.name ?? '';
      const artistName = a.artist?.name ?? '';
      const cover =
        a.image?.find((img) => img.size === 'extralarge')?.['#text'] ??
        a.image?.find((img) => img.size === 'large')?.['#text'] ??
        a.image?.[0]?.['#text'] ??
        null;

      return {
        mbid: a.mbid || a.artist?.mbid || null,
        title: name,
        artistName,
        artistMbid: a.artist?.mbid ?? null,
        coverUrl: cover || null,
      };
    });

    return NextResponse.json({
      tag,
      albums,
      meta: {
        count: albums.length,
      },
    });
  } catch (err) {
    if (err instanceof UpstreamError) {
      const { source, endpoint, status, retryAfterSeconds } = err;
      const statusCode = status === 429 ? 503 : 502;
      return errorResponse(statusCode, 'upstream_error', 'Upstream API error', {
        source,
        endpoint,
        status,
        retryAfterSeconds,
      });
    }

    console.error('[api/tags/[tag]/top-albums] unexpected_error', err);
    return errorResponse(500, 'internal_error', 'Unexpected server error.');
  }
}


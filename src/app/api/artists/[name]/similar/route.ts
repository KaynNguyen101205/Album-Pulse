import { NextRequest, NextResponse } from 'next/server';

import { getSimilarArtistsWithCache } from '@/server/clients/lastfm';
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
  params: { name: string };
};

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const name = params.name?.trim();
  if (!name) {
    return errorResponse(400, 'bad_request', 'Missing artist name in path.');
  }

  try {
    const data = await getSimilarArtistsWithCache(name, 20);
    const artistsRaw = data.similarartists?.artist ?? [];

    const artists = artistsRaw.map((a) => ({
      name: a.name ?? '',
      mbid: a.mbid || null,
    }));

    return NextResponse.json({
      artistName: name,
      similar: artists,
      meta: {
        count: artists.length,
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

    console.error('[api/artists/[name]/similar] unexpected_error', err);
    return errorResponse(500, 'internal_error', 'Unexpected server error.');
  }
}


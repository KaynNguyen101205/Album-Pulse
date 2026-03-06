import { NextRequest, NextResponse } from 'next/server';

import { getCoverArtUrlForReleaseGroup } from '@/server/clients/coverart';
import { searchAlbumsWithCache } from '@/server/clients/musicbrainz';
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

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (!q) {
    return errorResponse(400, 'bad_request', 'Missing or empty query parameter "q".');
  }

  try {
    const candidates = await searchAlbumsWithCache(q, {
      limit: 10,
      getCoverUrl: getCoverArtUrlForReleaseGroup,
    });

    return NextResponse.json({
      candidates,
      meta: {
        query: q,
        count: candidates.length,
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

    console.error('[api/albums/search] unexpected_error', err);
    return errorResponse(500, 'internal_error', 'Unexpected server error.');
  }
}


import { NextRequest, NextResponse } from 'next/server';

import { getCoverArtUrlForReleaseGroup } from '@/server/clients/coverart';
import { getReleaseGroupWithCache } from '@/server/clients/musicbrainz';
import { getAlbumInfoWithCache } from '@/server/clients/lastfm';
import { UpstreamError } from '@/server/clients/http';
import { normalizeAlbum } from '@/server/normalizers/albumNormalizer';

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
  params: { mbid: string };
};

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const mbid = params.mbid?.trim();
  if (!mbid) {
    return errorResponse(400, 'bad_request', 'Missing MBID in path.');
  }

  try {
    const rg = await getReleaseGroupWithCache(mbid);
    if (!rg) {
      return errorResponse(404, 'not_found', 'Album not found for given MBID.');
    }

    const artistName = rg['artist-credit']?.[0]?.name ?? '';
    const title = rg.title;

    const [lfAlbum, coverUrl] = await Promise.all([
      artistName && title ? getAlbumInfoWithCache(artistName, title) : Promise.resolve(null),
      getCoverArtUrlForReleaseGroup(mbid),
    ]);

    const dto = normalizeAlbum(rg, {
      lastfmAlbum: lfAlbum ?? undefined,
      coverUrl,
    });

    return NextResponse.json(dto);
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

    console.error('[api/albums/mb/[mbid]] unexpected_error', err);
    return errorResponse(500, 'internal_error', 'Unexpected server error.');
  }
}


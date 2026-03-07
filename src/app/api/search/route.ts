/**
 * GET /api/search
 * Search for albums (MusicBrainz). Optional: artists/genres can be added later.
 * Query: q (required, min 2 chars), limit (optional, 1–50).
 */
import { NextRequest } from 'next/server';
import { getCoverArtUrlForReleaseGroup } from '@/server/clients/coverart';
import { searchAlbumsWithCache } from '@/server/clients/musicbrainz';
import { UpstreamError } from '@/server/clients/http';
import { searchQuerySchema } from '@/lib/validation/schemas';
import { parseWithSchema } from '@/lib/validation/parse';
import { badRequest, internalError, upstreamError } from '@/lib/api/errors';
import type { SearchResultDTO } from '@/lib/dto';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const queryInput = {
    q: searchParams.get('q') ?? '',
    limit: searchParams.get('limit') ?? undefined,
  };
  const parsed = parseWithSchema(searchQuerySchema, queryInput);
  if (parsed.ok === false) return parsed.response;

  const { q, limit } = parsed.data;
  const effectiveLimit = limit ?? 10;

  try {
    const candidates = await searchAlbumsWithCache(q, {
      limit: effectiveLimit,
      getCoverUrl: getCoverArtUrlForReleaseGroup,
    });

    const dto: SearchResultDTO = {
      candidates: candidates.map((c) => ({
        mbid: c.mbid,
        title: c.title,
        artistName: c.artistName,
        releaseYear: c.releaseYear,
        coverUrl: c.coverUrl,
        artistMbid: c.artistMbid ?? undefined,
      })),
      meta: { query: q, count: candidates.length },
    };
    return Response.json(dto);
  } catch (err) {
    if (err instanceof UpstreamError) {
      const status = err.status === 429 ? 503 : 502;
      return upstreamError(status, 'Upstream API error.', {
        source: err.source,
        endpoint: err.endpoint,
        status: err.status,
      });
    }
    console.error('[api/search]', err);
    return internalError();
  }
}

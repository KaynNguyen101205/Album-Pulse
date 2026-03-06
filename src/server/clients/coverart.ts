import 'server-only';

import { getOrSet } from '@/server/cache/externalCache';
import { fetchJsonWithRetry } from '@/server/clients/http';

const COVERART_BASE_URL = 'https://coverartarchive.org';
const COVER_TTL_SECONDS = 7 * 24 * 60 * 60; // 7d

type CoverArtImage = {
  image?: string;
  front?: boolean;
  thumbnails?: Record<string, string>;
};

type CoverArtResponse = {
  images?: CoverArtImage[];
};

export async function getCoverArtUrlForReleaseGroup(
  mbid: string
): Promise<string | null> {
  const cacheKey = `caa:cover:${mbid}`;

  return getOrSet<string | null>(
    cacheKey,
    COVER_TTL_SECONDS,
    'coverart',
    async () => {
      const url = `${COVERART_BASE_URL}/release-group/${encodeURIComponent(
        mbid
      )}`;

      try {
        const { data } = await fetchJsonWithRetry<CoverArtResponse>(
          url,
          {},
          { source: 'coverart', endpoint: 'release-group.cover' }
        );

        const images = data.images ?? [];
        if (images.length === 0) return null;

        const front =
          images.find((img) => img.front) ??
          images.find((img) => !!img.image) ??
          images[0];

        if (!front) return null;

        const thumb =
          front.thumbnails?.['500'] ??
          front.thumbnails?.['250'] ??
          front.image ??
          null;

        return thumb ?? null;
      } catch {
        // 404 or other errors: no cover
        return null;
      }
    }
  );
}


import 'server-only';

import { getOrSet } from '@/server/cache/externalCache';
import { fetchJsonWithRetry } from '@/server/clients/http';

const MUSICBRAINZ_BASE_URL = 'https://musicbrainz.org/ws/2';
const USER_AGENT =
  process.env.MUSICBRAINZ_USER_AGENT ??
  'AlbumPulse/0.1 (contact: not-set@example.com)';

const SEARCH_TTL_SECONDS = 24 * 60 * 60; // 24h
const ALBUM_TTL_SECONDS = 7 * 24 * 60 * 60; // 7d

export type MusicBrainzReleaseGroup = {
  id: string;
  title: string;
  'first-release-date'?: string;
  'artist-credit'?: Array<{
    name: string;
    artist?: { id?: string };
  }>;
  tags?: Array<{ name?: string }>;
};

export type MusicBrainzSearchResponse = {
  'release-groups'?: MusicBrainzReleaseGroup[];
};

export type MusicBrainzReleaseGroupResponse = MusicBrainzReleaseGroup & {
  releases?: Array<{
    id: string;
    date?: string;
  }>;
};

export type MusicBrainzSearchCandidate = {
  mbid: string;
  title: string;
  artistName: string;
  artistMbid: string | null;
  releaseYear: number | null;
  tags: string[];
  coverUrl: string | null;
};

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, ' ');
}

function extractYear(date?: string): number | null {
  if (!date) return null;
  const year = Number(date.slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

export async function searchAlbumsWithCache(
  query: string,
  opts: {
    limit?: number;
    getCoverUrl?: (mbid: string) => Promise<string | null>;
  } = {}
): Promise<MusicBrainzSearchCandidate[]> {
  const limit = opts.limit ?? 10;
  const normalized = normalizeQuery(query);
  const cacheKey = `mb:search:${normalized}`;

  return getOrSet(cacheKey, SEARCH_TTL_SECONDS, 'musicbrainz', async () => {
    const url = `${MUSICBRAINZ_BASE_URL}/release-group?${new URLSearchParams({
      query,
      type: 'album',
      fmt: 'json',
      limit: String(limit),
    }).toString()}`;

    const { data } = await fetchJsonWithRetry<MusicBrainzSearchResponse>(
      url,
      {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
        },
      },
      { source: 'musicbrainz', endpoint: 'release-group.search' }
    );

    const groups = data['release-groups'] ?? [];

    const candidates: MusicBrainzSearchCandidate[] = [];
    for (const rg of groups.slice(0, limit)) {
      const mbid = rg.id;
      const title = rg.title;
      const ac = rg['artist-credit']?.[0];
      const artistName = ac?.name ?? '';
      const artistMbid = ac?.artist?.id ?? null;
      const releaseYear =
        extractYear(rg['first-release-date']) ??
        extractYear(rg.releases?.[0]?.date);
      const tags =
        rg.tags?.map((t) => t.name?.toLowerCase().trim()).filter(Boolean) ??
        [];

      let coverUrl: string | null = null;
      if (opts.getCoverUrl) {
        try {
          coverUrl = await opts.getCoverUrl(mbid);
        } catch {
          coverUrl = null;
        }
      }

      candidates.push({
        mbid,
        title,
        artistName,
        artistMbid,
        releaseYear,
        tags: tags as string[],
        coverUrl,
      });
    }

    return candidates;
  });
}

export async function getReleaseGroupWithCache(
  mbid: string
): Promise<MusicBrainzReleaseGroupResponse | null> {
  const cacheKey = `mb:release-group:${mbid}`;

  return getOrSet(cacheKey, ALBUM_TTL_SECONDS, 'musicbrainz', async () => {
    const url = `${MUSICBRAINZ_BASE_URL}/release-group/${encodeURIComponent(
      mbid
    )}?${new URLSearchParams({
      inc: 'artists+releases+tags',
      fmt: 'json',
    }).toString()}`;

    const { data } = await fetchJsonWithRetry<MusicBrainzReleaseGroupResponse>(
      url,
      {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
        },
      },
      { source: 'musicbrainz', endpoint: 'release-group.get' }
    );

    return data;
  });
}


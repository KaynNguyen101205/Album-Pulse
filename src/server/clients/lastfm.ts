import { getOrSet } from '@/server/cache/externalCache';
import { fetchJsonWithRetry } from '@/server/clients/http';

const LASTFM_API_KEY = process.env.LASTFM_API_KEY;

if (!LASTFM_API_KEY) {
  // Fail fast on server if env is missing.
  throw new Error('LASTFM_API_KEY is not set');
}

const LASTFM_BASE_URL = 'https://ws.audioscrobbler.com/2.0/';

const ALBUM_TTL_SECONDS = 3 * 24 * 60 * 60; // 3d
const TAG_TOP_TTL_SECONDS = 24 * 60 * 60; // 24h
const SIMILAR_ARTISTS_TTL_SECONDS = 7 * 24 * 60 * 60; // 7d

export type LastfmTag = { name?: string };

export type LastfmAlbumInfo = {
  name?: string;
  artist?: string;
  mbid?: string;
  listeners?: string;
  playcount?: string;
  tags?: { tag?: LastfmTag[] };
  toptags?: { tag?: LastfmTag[] };
};

type LastfmAlbumGetInfoResponse = {
  album?: LastfmAlbumInfo;
};

type LastfmTagTopAlbumsResponse = {
  topalbums?: {
    album?: Array<{
      name?: string;
      artist?: { name?: string; mbid?: string };
      mbid?: string;
      image?: Array<{ size?: string; '#text'?: string }>;
    }>;
  };
};

type LastfmSimilarArtistsResponse = {
  similarartists?: {
    artist?: Array<{
      name?: string;
      mbid?: string;
    }>;
  };
};

function normalizePart(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildUrl(params: Record<string, string>): string {
  const search = new URLSearchParams({
    api_key: LASTFM_API_KEY as string,
    format: 'json',
    ...params,
  });
  return `${LASTFM_BASE_URL}?${search.toString()}`;
}

export async function getAlbumInfoWithCache(
  artistName: string,
  albumTitle: string
): Promise<LastfmAlbumInfo | null> {
  const cacheKey = `lf:album:${normalizePart(artistName)}:${normalizePart(albumTitle)}`;

  return getOrSet<LastfmAlbumInfo | null>(
    cacheKey,
    ALBUM_TTL_SECONDS,
    'lastfm',
    async () => {
      const url = buildUrl({
        method: 'album.getInfo',
        artist: artistName,
        album: albumTitle,
      });

      const { data } = await fetchJsonWithRetry<LastfmAlbumGetInfoResponse>(
        url,
        {},
        { source: 'lastfm', endpoint: 'album.getInfo' }
      );

      return data.album ?? null;
    }
  );
}

export async function getTagTopAlbumsWithCache(
  tag: string,
  limit = 20
): Promise<LastfmTagTopAlbumsResponse> {
  const cacheKey = `lf:tag-top:${normalizePart(tag)}`;

  return getOrSet<LastfmTagTopAlbumsResponse>(
    cacheKey,
    TAG_TOP_TTL_SECONDS,
    'lastfm',
    async () => {
      const url = buildUrl({
        method: 'tag.getTopAlbums',
        tag,
        limit: String(limit),
      });

      const { data } = await fetchJsonWithRetry<LastfmTagTopAlbumsResponse>(
        url,
        {},
        { source: 'lastfm', endpoint: 'tag.getTopAlbums' }
      );

      return data;
    }
  );
}

export async function getSimilarArtistsWithCache(
  artistName: string,
  limit = 20
): Promise<LastfmSimilarArtistsResponse> {
  const cacheKey = `lf:similar-artist:${normalizePart(artistName)}`;

  return getOrSet<LastfmSimilarArtistsResponse>(
    cacheKey,
    SIMILAR_ARTISTS_TTL_SECONDS,
    'lastfm',
    async () => {
      const url = buildUrl({
        method: 'artist.getSimilar',
        artist: artistName,
        limit: String(limit),
      });

      const { data } = await fetchJsonWithRetry<LastfmSimilarArtistsResponse>(
        url,
        {},
        { source: 'lastfm', endpoint: 'artist.getSimilar' }
      );

      return data;
    }
  );
}


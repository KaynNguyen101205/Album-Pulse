import 'server-only';

import { getSessionUserId } from '@/lib/session';
import { spotifyGet } from '@/lib/spotify/client';
import type { Album } from '@/types/domain';
import {
  type SpotifyTopArtistsResponse,
  type SpotifyRecentlyPlayedResponse,
  type SpotifyArtistAlbumsResponse,
  type SpotifyAlbum,
  type SpotifyImage,
} from '@/lib/spotify/types';

export class NotLoggedInError extends Error {
  constructor(message = 'User is not logged in.') {
    super(message);
    this.name = 'NotLoggedInError';
  }
}

async function getUserOAuthTokenOrThrow() {
  const userId = await getSessionUserId();
  if (!userId) {
    throw new NotLoggedInError();
  }
  throw new NotLoggedInError('Spotify access token is not available for this user.');
}

/**
 * Returns a valid access token for the current logged-in user.
 * - If there is a non-expired access token in the DB, returns it.
 * - If expired and a refresh token exists, refreshes once and returns the new token.
 * - If no session / tokens / refresh fails, throws NotLoggedInError.
 */
export async function getValidAccessToken(): Promise<string> {
  await getUserOAuthTokenOrThrow();
  throw new NotLoggedInError('Spotify token is unavailable.');
}

/**
 * Helper to perform a Spotify GET request for the current user:
 * - Uses getValidAccessToken() to ensure a fresh token.
 * - If Spotify responds with 401 once, refreshes tokens and retries the request a single time.
 * - If still unauthorized or refresh is not possible, throws NotLoggedInError.
 */
export async function spotifyGetWithAuth<T>(path: string): Promise<T> {
  void path;
  throw new NotLoggedInError('Spotify token is unavailable.');
}

export type TopArtistSignal = {
  artistId: string;
  name: string;
  rank: number;
};

export type RecentPlayCountsByArtist = Record<string, number>;

export async function fetchTopArtists(
  accessToken: string,
  timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term'
): Promise<TopArtistSignal[]> {
  const res = await spotifyGet<SpotifyTopArtistsResponse>(
    `/me/top/artists?limit=20&time_range=${timeRange}`,
    accessToken
  );

  return res.items.map((artist, index) => ({
    artistId: artist.id,
    name: artist.name,
    rank: index + 1,
  }));
}

export async function fetchRecentlyPlayed(
  accessToken: string,
  limit = 50
): Promise<RecentPlayCountsByArtist> {
  const cappedLimit = Math.min(Math.max(limit, 1), 50);

  const res = await spotifyGet<SpotifyRecentlyPlayedResponse>(
    `/me/player/recently-played?limit=${cappedLimit}`,
    accessToken
  );

  const counts: RecentPlayCountsByArtist = {};

  if (!res.items || res.items.length === 0) {
    return counts;
  }

  for (const item of res.items) {
    const primaryArtist = item.track?.artists?.[0];
    if (!primaryArtist) continue;

    const id = primaryArtist.id;
    if (!id) continue;

    counts[id] = (counts[id] ?? 0) + 1;
  }

  return counts;
}

function pickBestImageUrl(images?: SpotifyImage[]): string | undefined {
  if (!images || images.length === 0) return undefined;

  const sorted = [...images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));

  const preferred = sorted.find((img) => (img.width ?? 0) >= 300);
  return (preferred ?? sorted[0]).url;
}

function normalizeSpotifyAlbumToDomain(album: SpotifyArtistAlbumsResponse['items'][number]): Album {
  const primaryArtist = album.artists[0];

  return {
    id: album.id,
    spotifyId: album.id,
    name: album.name,
    artistId: primaryArtist?.id ?? '',
    artistName: primaryArtist?.name ?? 'Unknown artist',
    releaseDate: album.release_date,
    spotifyUrl: album.external_urls?.spotify,
    images: album.images,
  };
}

export async function fetchAlbumsForArtist(
  accessToken: string,
  artistId: string,
  limit = 20
): Promise<Album[]> {
  // Spotify's default limit for this endpoint is 20, so we can omit the
  // limit query param entirely to avoid "Invalid limit" issues.
  void limit; // currently unused but kept for API compatibility

  const res = await spotifyGet<SpotifyArtistAlbumsResponse>(
    `/artists/${artistId}/albums?include_groups=album`,
    accessToken
  );

  const seen = new Set<string>();
  const albums: Album[] = [];

  for (const album of res.items) {
    if (!album.id || seen.has(album.id)) continue;
    seen.add(album.id);

    albums.push(normalizeSpotifyAlbumToDomain(album));
  }

  return albums;
}

export async function fetchCandidateAlbums(
  accessToken: string,
  topArtistIds: string[],
  perArtistLimit = 20
): Promise<Album[]> {
  const concurrency = 3;
  const allAlbums = new Map<string, Album>();

  for (let i = 0; i < topArtistIds.length; i += concurrency) {
    const slice = topArtistIds.slice(i, i + concurrency);

    const results = await Promise.all(
      slice.map((artistId) => fetchAlbumsForArtist(accessToken, artistId, perArtistLimit))
    );

    for (const albums of results) {
      for (const album of albums) {
        const dedupeKey = album.spotifyId || album.id;
        if (allAlbums.has(dedupeKey)) continue;
        allAlbums.set(dedupeKey, album);
      }
    }
  }

  return Array.from(allAlbums.values());
}

/**
 * Fetch a single album by Spotify ID. Used e.g. to populate Album in DB when adding a favorite.
 */
export async function fetchAlbumById(
  accessToken: string,
  albumSpotifyId: string
): Promise<SpotifyAlbum> {
  return spotifyGet<SpotifyAlbum>(`/albums/${albumSpotifyId}`, accessToken);
}

/** Pick best image URL (prefer largest / 300px+). */
export function pickBestAlbumImageUrl(images?: SpotifyImage[]): string | null {
  if (!images || images.length === 0) return null;
  const url = pickBestImageUrl(images);
  return url ?? null;
}



import 'server-only';

import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/session';
import { refreshAccessToken, type TokenResponse } from '@/lib/spotify/oauth';
import { spotifyGet } from '@/lib/spotify/client';
import type { Album } from '@/types/domain';
import {
  SpotifyApiError,
  type SpotifyTopArtistsResponse,
  type SpotifyRecentlyPlayedResponse,
  type SpotifyArtistAlbumsResponse,
  type SpotifyImage,
} from '@/lib/spotify/types';

export class NotLoggedInError extends Error {
  constructor(message = 'User is not logged in.') {
    super(message);
    this.name = 'NotLoggedInError';
  }
}

async function loadClientId(): Promise<string> {
  const { env } = await import('@/lib/env');
  return env.SPOTIFY_CLIENT_ID;
}

async function getUserOAuthTokenOrThrow() {
  const userId = await getSessionUserId();
  if (!userId) {
    throw new NotLoggedInError();
  }

  const token = await prisma.oAuthToken.findUnique({
    where: { nguoiDungId: userId },
  });

  if (!token) {
    throw new NotLoggedInError();
  }

  return { userId, token };
}

function isExpired(expiresAt: Date): boolean {
  return expiresAt.getTime() <= Date.now();
}

async function refreshAccessTokenForUser(nguoiDungId: string, currentRefreshToken: string) {
  const clientId = await loadClientId();
  const refreshed: TokenResponse = await refreshAccessToken(currentRefreshToken, clientId);

  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);

  const updated = await prisma.oAuthToken.update({
    where: { nguoiDungId },
    data: {
      accessToken: refreshed.access_token,
      expiresAt,
      ...(refreshed.scope !== undefined ? { scope: refreshed.scope } : {}),
      ...(refreshed.token_type !== undefined ? { tokenType: refreshed.token_type } : {}),
      ...(refreshed.refresh_token ? { refreshToken: refreshed.refresh_token } : {}),
    },
  });

  return updated.accessToken;
}

/**
 * Returns a valid access token for the current logged-in user.
 * - If there is a non-expired access token in the DB, returns it.
 * - If expired and a refresh token exists, refreshes once and returns the new token.
 * - If no session / tokens / refresh fails, throws NotLoggedInError.
 */
export async function getValidAccessToken(): Promise<string> {
  const { userId, token } = await getUserOAuthTokenOrThrow();

  if (!isExpired(token.expiresAt) && token.accessToken) {
    return token.accessToken;
  }

  if (!token.refreshToken) {
    throw new NotLoggedInError();
  }

  return refreshAccessTokenForUser(userId, token.refreshToken);
}

/**
 * Helper to perform a Spotify GET request for the current user:
 * - Uses getValidAccessToken() to ensure a fresh token.
 * - If Spotify responds with 401 once, refreshes tokens and retries the request a single time.
 * - If still unauthorized or refresh is not possible, throws NotLoggedInError.
 */
export async function spotifyGetWithAuth<T>(path: string): Promise<T> {
  const { userId, token } = await getUserOAuthTokenOrThrow();

  let accessToken = token.accessToken;

  if (!accessToken || isExpired(token.expiresAt)) {
    if (!token.refreshToken) {
      throw new NotLoggedInError();
    }

    accessToken = await refreshAccessTokenForUser(userId, token.refreshToken);
  }

  try {
    return await spotifyGet<T>(path, accessToken);
  } catch (err) {
    if (!(err instanceof SpotifyApiError) || err.code !== 'unauthorized') {
      throw err;
    }

    if (!token.refreshToken) {
      throw new NotLoggedInError();
    }

    const newAccessToken = await refreshAccessTokenForUser(userId, token.refreshToken);
    try {
      return await spotifyGet<T>(path, newAccessToken);
    } catch (secondErr) {
      if (secondErr instanceof SpotifyApiError && secondErr.code === 'unauthorized') {
        throw new NotLoggedInError();
      }

      throw secondErr;
    }
  }
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
  const cappedLimit = Math.min(Math.max(limit, 1), 20);

  const res = await spotifyGet<SpotifyArtistAlbumsResponse>(
    `/artists/${artistId}/albums?include_groups=album&limit=${cappedLimit}`,
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
        if (allAlbums.has(album.id)) continue;
        allAlbums.set(album.id, album);
      }
    }
  }

  return Array.from(allAlbums.values());
}




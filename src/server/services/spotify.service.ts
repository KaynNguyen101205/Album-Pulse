import 'server-only';

import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/session';
import { refreshAccessToken, type TokenResponse } from '@/lib/spotify/oauth';
import { spotifyGet } from '@/lib/spotify/client';
import { SpotifyApiError } from '@/lib/spotify/types';

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


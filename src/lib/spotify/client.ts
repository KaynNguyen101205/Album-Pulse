import 'server-only';

import { SpotifyApiError, type SpotifyErrorCode } from './types';

const SPOTIFY_API_BASE_URL = 'https://api.spotify.com/v1';

export function getRetryAfterSeconds(res: Response): number | undefined {
  const value = res.headers.get('Retry-After');
  if (!value) return undefined;

  const seconds = Number.parseInt(value, 10);
  if (Number.isNaN(seconds) || seconds < 0) {
    return undefined;
  }

  return seconds;
}

export async function safeJson(res: Response): Promise<unknown | null> {
  if (res.status === 204 || res.status === 205) {
    return null;
  }

  const text = await res.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function buildSpotifyUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  if (path.startsWith('/')) {
    return `${SPOTIFY_API_BASE_URL}${path}`;
  }

  return `${SPOTIFY_API_BASE_URL}/${path}`;
}

function extractSpotifyErrorMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const anyPayload = payload as any;

  if (typeof anyPayload.error === 'string') {
    return anyPayload.error;
  }

  if (
    anyPayload.error &&
    typeof anyPayload.error === 'object' &&
    typeof anyPayload.error.message === 'string'
  ) {
    return anyPayload.error.message;
  }

  if (typeof anyPayload.message === 'string') {
    return anyPayload.message;
  }

  return undefined;
}

function mapStatusToErrorCode(status: number): SpotifyErrorCode {
  if (status === 401) return 'unauthorized';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'internal_error';
  return 'bad_request';
}

export async function spotifyRequest<T>(
  method: string,
  path: string,
  accessToken: string,
  body?: unknown,
  init?: RequestInit
): Promise<T> {
  const url = buildSpotifyUrl(path);

  const headers = new Headers(init?.headers ?? {});
  headers.set('Authorization', `Bearer ${accessToken}`);
  headers.set('Accept', 'application/json');

  let requestBody: BodyInit | undefined = init?.body;
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
    requestBody = JSON.stringify(body);
  }

  const res = await fetch(url, {
    ...init,
    method,
    headers,
    body: requestBody,
  });

  const data = await safeJson(res);

  if (!res.ok) {
    const status = res.status;
    const code = mapStatusToErrorCode(status);
    const retryAfterSeconds = status === 429 ? getRetryAfterSeconds(res) : undefined;

    const spotifyMessage = extractSpotifyErrorMessage(data);
    const message =
      spotifyMessage ?? `Spotify request failed with status ${status} (${code})`;

    throw new SpotifyApiError({
      code,
      status,
      retryAfterSeconds,
      details: data,
      message,
    });
  }

  return (data as T) ?? (null as T);
}

export function spotifyGet<T>(
  path: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  return spotifyRequest<T>('GET', path, accessToken, undefined, init);
}


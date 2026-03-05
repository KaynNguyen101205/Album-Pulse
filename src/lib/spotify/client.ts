import 'server-only';

import { SpotifyApiError, type SpotifyErrorCode } from './types';

const SPOTIFY_API_BASE_URL = 'https://api.spotify.com/v1';

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
    // Fall back to raw text so callers can log/debug non-JSON responses
    return text;
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

  const maxAttempts = 3;

  // Retries:
  // - 429 with Retry-After: wait exactly header seconds (+ small jitter) then retry
  // - 429 without Retry-After: exponential backoff 500ms, 1000ms, 2000ms
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const res = await fetch(url, {
      ...init,
      method,
      headers,
      body: requestBody,
    });

    const data = await safeJson(res);

    if (res.ok) {
      return (data as T) ?? (null as T);
    }

    const status = res.status;

    if (status === 429 && attempt < maxAttempts) {
      const retryAfterSeconds = getRetryAfterSeconds(res);

      if (retryAfterSeconds !== undefined) {
        const jitterMs = 100 + Math.floor(Math.random() * 200);
        await sleep(retryAfterSeconds * 1000 + jitterMs);
      } else {
        const backoffMs = 500 * 2 ** (attempt - 1);
        await sleep(backoffMs);
      }

      continue;
    }

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

  // Should not be reachable because we throw inside the loop on the last attempt,
  // but keep a defensive fallback.
  throw new SpotifyApiError({
    code: 'rate_limited',
    status: 429,
    message: 'Spotify request failed after maximum retry attempts (rate limited).',
  });
}

export function spotifyGet<T>(
  path: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  return spotifyRequest<T>('GET', path, accessToken, undefined, init);
}


import 'server-only';

const SPOTIFY_API_BASE_URL = 'https://api.spotify.com/v1';

export type SpotifyApiErrorCode = 'rate_limited' | 'unauthorized' | 'internal_error';

export type SpotifyApiErrorDetails = {
  status: number;
  message?: string;
  retryAfterSeconds?: number;
};

export class SpotifyApiError extends Error {
  readonly code: SpotifyApiErrorCode;
  readonly details: SpotifyApiErrorDetails;

  constructor(code: SpotifyApiErrorCode, details: SpotifyApiErrorDetails) {
    const baseMessage = details.message ?? 'Spotify API request failed';
    super(`${code}: ${baseMessage}`);
    this.name = 'SpotifyApiError';
    this.code = code;
    this.details = details;
  }
}

export async function spotifyGet<T>(path: string, accessToken: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${SPOTIFY_API_BASE_URL}${path}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (res.ok) {
    // Spotify uses JSON for all Web API responses in this app.
    return (await res.json()) as T;
  }

  const status = res.status;
  const retryAfterHeader = res.headers.get('Retry-After');
  const retryAfterSeconds = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : undefined;

  let bodyMessage: string | undefined;
  try {
    const body = await res.json().catch(async () => {
      const text = await res.text();
      return text ? { error: { message: text } } : undefined;
    });
    // Spotify error shape: { error: { status: number, message: string } }
    if (body && typeof body === 'object') {
      const maybeError = (body as any).error;
      if (maybeError && typeof maybeError.message === 'string') {
        bodyMessage = maybeError.message;
      }
    }
  } catch {
    // Ignore JSON parsing errors; we'll fall back to generic messages.
  }

  const details: SpotifyApiErrorDetails = {
    status,
    message: bodyMessage,
    retryAfterSeconds,
  };

  if (status === 401 || status === 403) {
    throw new SpotifyApiError('unauthorized', details);
  }

  if (status === 429) {
    throw new SpotifyApiError('rate_limited', details);
  }

  if (status >= 500) {
    throw new SpotifyApiError('internal_error', details);
  }

  throw new SpotifyApiError('internal_error', details);
}


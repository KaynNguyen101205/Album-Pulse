import 'server-only';
import { spotifyGet } from './client';

const PKCE_CHARSET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
const STATE_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function randomString(length: number, charset: string): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);

  const chars = Array.from(array, (byte) => charset[byte % charset.length]);
  return chars.join('');
}

export function taoCodeVerifier(length = 64): string {
  if (length < 43 || length > 128) {
    throw new Error('PKCE code_verifier length must be between 43 and 128 characters.');
  }

  return randomString(length, PKCE_CHARSET);
}

export async function taoCodeChallengeS256(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);

  return base64urlEncode(digest);
}

export function taoState(length = 32): string {
  return randomString(length, STATE_CHARSET);
}

export function base64urlEncode(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
  const base64 = Buffer.from(bytes).toString('base64');

  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_ME_URL = 'https://api.spotify.com/v1/me';

export class SpotifyOAuthError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'SpotifyOAuthError';
    this.status = status;
    this.details = details;
  }
}

export type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
};

async function safeParseOAuthError(res: Response): Promise<unknown> {
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  try {
    const text = await res.text();
    return text || null;
  } catch {
    return null;
  }
}

function extractOAuthErrorMessage(details: unknown, fallback: string): string {
  if (!details) return fallback;

  if (typeof details === 'string' && details.trim()) {
    return details;
  }

  if (typeof details === 'object') {
    const record = details as Record<string, unknown>;
    const fromDescription = record.error_description;
    if (typeof fromDescription === 'string' && fromDescription.trim()) {
      return fromDescription;
    }
    const fromError = record.error;
    if (typeof fromError === 'string' && fromError.trim()) {
      return fromError;
    }
  }

  return fallback;
}

function buildOAuthError(prefix: string, status: number, details: unknown): SpotifyOAuthError {
  const message = extractOAuthErrorMessage(details, `${prefix} failed with status ${status}`);
  return new SpotifyOAuthError(message, status, details);
}

export async function refreshAccessToken(
  refreshToken: string,
  clientId: string
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  });

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const details = await safeParseOAuthError(res);
    throw buildOAuthError('Spotify token refresh', res.status, details);
  }

  return res.json() as Promise<TokenResponse>;
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string,
  clientId: string
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
  });

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const details = await safeParseOAuthError(res);
    throw buildOAuthError('Spotify token exchange', res.status, details);
  }

  return res.json() as Promise<TokenResponse>;
}

export type SpotifyMeProfile = {
  id: string;
  display_name: string | null;
  email?: string | null;
  images?: Array<{ url: string }>;
  country?: string | null;
  product?: string | null;
};

export async function fetchSpotifyMe(accessToken: string): Promise<SpotifyMeProfile> {
  return spotifyGet<SpotifyMeProfile>(SPOTIFY_ME_URL, accessToken);
}


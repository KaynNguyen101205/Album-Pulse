import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { taoCodeVerifier, taoCodeChallengeS256, taoState } from '@/lib/spotify/oauth';
import { serializeScopes, SPOTIFY_LOGIN_SCOPES } from '@/lib/spotify/scopes';

const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const OAUTH_SCOPE = serializeScopes(SPOTIFY_LOGIN_SCOPES);

export async function GET() {
  let clientId: string;
  let redirectUri: string;

  try {
    const { env } = await import('@/lib/env');
    clientId = env.SPOTIFY_CLIENT_ID.trim();
    redirectUri = env.SPOTIFY_REDIRECT_URI.trim();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Missing required environment variables for Spotify OAuth.';

    return NextResponse.json({ error: message }, { status: 500 });
  }

  const codeVerifier = taoCodeVerifier();
  const codeChallenge = await taoCodeChallengeS256(codeVerifier);
  const state = taoState();

  const isProd = process.env.NODE_ENV === 'production';
  const cookieOptions = {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    secure: isProd,
    path: '/',
    maxAge: 600, // ~10 minutes
  };

  const cookieStore = cookies();
  cookieStore.set('spotify_code_verifier', codeVerifier, cookieOptions);
  cookieStore.set('oauth_state', state, cookieOptions);

  const url = new URL(SPOTIFY_AUTHORIZE_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', OAUTH_SCOPE);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('code_challenge', codeChallenge);

  return NextResponse.redirect(url.toString(), 302);
}

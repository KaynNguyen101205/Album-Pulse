import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeCodeForTokens, fetchSpotifyMe } from '@/lib/spotify/oauth';
import { createSessionRecord, getSessionCookieName, getSessionCookieOptions } from '@/lib/session';
import { upsertUserAndTokens } from '@/server/services/auth.service';

const CLEAR_COOKIE_OPTIONS = {
  httpOnly: true as const,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 0,
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  const cookieStore = cookies();

  let clientId: string;
  let redirectUri: string;

  try {
    const { env } = await import('@/lib/env');
    clientId = env.SPOTIFY_CLIENT_ID;
    redirectUri = env.SPOTIFY_REDIRECT_URI;
  } catch {
    return NextResponse.json(
      { error: 'Missing required environment variables for Spotify OAuth.' },
      { status: 500 }
    );
  }

  const codeVerifier = cookieStore.get('spotify_code_verifier')?.value;
  const oauthState = cookieStore.get('oauth_state')?.value;

  if (!code) {
    return NextResponse.json({ error: 'MISSING_CODE' }, { status: 400 });
  }
  if (!codeVerifier) {
    return NextResponse.json({ error: 'MISSING_CODE_VERIFIER' }, { status: 400 });
  }
  if (!state || !oauthState || state !== oauthState) {
    return NextResponse.json({ error: 'INVALID_STATE' }, { status: 400 });
  }

  let tokens;
  try {
    tokens = await exchangeCodeForTokens(code, codeVerifier, redirectUri, clientId);
  } catch (e) {
    return NextResponse.json(
      { error: 'TOKEN_EXCHANGE_FAILED' },
      { status: 401 }
    );
  }

  let profile;
  try {
    profile = await fetchSpotifyMe(tokens.access_token);
  } catch {
    return NextResponse.json(
      { error: 'FETCH_PROFILE_FAILED' },
      { status: 500 }
    );
  }

  let nguoiDungId: string;
  try {
    nguoiDungId = await upsertUserAndTokens(profile, tokens);
  } catch (err) {
    console.error('[callback] DB upsert failed:', err);
    return NextResponse.json(
      { error: 'DB_UPSERT_FAILED' },
      { status: 500 }
    );
  }

  const sessionId = await createSessionRecord(nguoiDungId);

  const isProd = process.env.NODE_ENV === 'production';
  const res = NextResponse.redirect(new URL('/dashboard', request.url), 302);

  res.cookies.set('spotify_code_verifier', '', { ...CLEAR_COOKIE_OPTIONS, secure: isProd });
  res.cookies.set('oauth_state', '', { ...CLEAR_COOKIE_OPTIONS, secure: isProd });

  res.cookies.set(getSessionCookieName(), sessionId, getSessionCookieOptions());

  return res;
}

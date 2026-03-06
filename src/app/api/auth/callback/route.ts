import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeCodeForTokens, fetchSpotifyMe } from '@/lib/spotify/oauth';
import {
  buildTokenExchangeFailedLogMeta,
  buildTokenExchangeFailedPayload,
  resolveTokenExchangeFailedStatus,
  buildFetchProfileFailedLogMeta,
} from '@/lib/spotify/callback-errors';
import { getMissingScopes, SPOTIFY_PROFILE_SCOPES } from '@/lib/spotify/scopes';
import { prisma } from '@/lib/prisma';
import { setSessionCookie } from '@/lib/session';
import { upsertUserAndTokens } from '@/server/services/auth.service';

export const runtime = 'nodejs';

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
  const isProduction = process.env.NODE_ENV === 'production';

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
    console.error('[callback] token exchange failed', buildTokenExchangeFailedLogMeta(e));
    return NextResponse.json(
      buildTokenExchangeFailedPayload(e, isProduction),
      { status: resolveTokenExchangeFailedStatus(e, isProduction) }
    );
  }

  console.info('[callback] token exchange success', {
    hasAccessToken: Boolean(tokens.access_token),
    tokenType: tokens.token_type,
    expiresIn: tokens.expires_in,
    scope: tokens.scope ?? null,
  });

  if (typeof tokens.scope === 'string' && tokens.scope.trim()) {
    const missingScopes = getMissingScopes(tokens.scope, SPOTIFY_PROFILE_SCOPES);
    if (missingScopes.length > 0) {
      console.warn('[callback] token scopes missing required profile scopes', {
        grantedScopes: tokens.scope,
        missingScopes,
      });
    }
  }

  const profileEndpoint = 'https://api.spotify.com/v1/me';
  let profile;
  try {
    profile = await fetchSpotifyMe(tokens.access_token);
  } catch (err) {
    console.error('[callback] fetch profile failed', {
      endpoint: profileEndpoint,
      ...buildFetchProfileFailedLogMeta(err),
    });
    // Redirect to landing with error so user sees a message instead of raw JSON
    const landingUrl = new URL('/', request.url);
    landingUrl.searchParams.set('error', 'FETCH_PROFILE_FAILED');
    return NextResponse.redirect(landingUrl, 302);
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

  const onboardingStatus = await prisma.nguoiDung.findUnique({
    where: { id: nguoiDungId },
    select: { onboardingCompletedAt: true },
  });
  const redirectPath = onboardingStatus?.onboardingCompletedAt ? '/dashboard' : '/onboarding';
  const res = NextResponse.redirect(new URL(redirectPath, request.url), 302);

  res.cookies.set('spotify_code_verifier', '', { ...CLEAR_COOKIE_OPTIONS, secure: isProduction });
  res.cookies.set('oauth_state', '', { ...CLEAR_COOKIE_OPTIONS, secure: isProduction });

  await setSessionCookie(res, nguoiDungId);

  return res;
}

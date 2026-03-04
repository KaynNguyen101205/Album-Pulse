import 'server-only';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const SESSION_COOKIE_NAME = 'album_pulse_session';
const SESSION_MAX_AGE_DAYS = 7;

function getCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    secure: isProd,
    path: '/' as const,
    maxAge: SESSION_MAX_AGE_DAYS * 24 * 60 * 60,
  };
}

/** Returns the current user id if the session cookie is valid, otherwise null. */
export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) return null;

  const phien = await prisma.phienDangNhap.findUnique({
    where: { id: sessionId },
    select: { nguoiDungId: true, expiresAt: true },
  });

  if (!phien || phien.expiresAt < new Date()) return null;
  return phien.nguoiDungId;
}

/**
 * Returns the current user id, or a 401 JSON response with { error: "not_logged_in" }.
 * Use in API routes: const auth = await requireSession(); if (auth instanceof NextResponse) return auth; const userId = auth;
 */
export async function requireSession(): Promise<string | NextResponse> {
  const userId = await getSessionUserId();
  if (userId === null) {
    return NextResponse.json({ error: 'not_logged_in' }, { status: 401 });
  }
  return userId;
}

/**
 * Creates a DB session record and sets the session cookie on the response.
 * Call this after successful login.
 */
export async function setSessionCookie(res: NextResponse, userId: string): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_MAX_AGE_DAYS);

  const phien = await prisma.phienDangNhap.create({
    data: { nguoiDungId: userId, expiresAt },
  });

  res.cookies.set(SESSION_COOKIE_NAME, phien.id, getCookieOptions());
}

/**
 * Clears the session cookie on the response and deletes the session from the DB if present.
 * Call this on logout.
 */
export async function clearSessionCookie(res: NextResponse): Promise<void> {
  const cookieStore = cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (sessionId) {
    await prisma.phienDangNhap.deleteMany({ where: { id: sessionId } });
  }

  const isProd = process.env.NODE_ENV === 'production';
  res.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: 0,
  });
}

// Legacy helpers (used by auth callback)
export function getSessionCookieName(): string {
  return SESSION_COOKIE_NAME;
}

export function getSessionCookieOptions(): ReturnType<typeof getCookieOptions> {
  return getCookieOptions();
}

/** @deprecated Use getSessionUserId() instead. */
export async function getSession(): Promise<{ nguoiDungId: string } | null> {
  const userId = await getSessionUserId();
  return userId === null ? null : { nguoiDungId: userId };
}

/** @deprecated Use setSessionCookie(res, userId) instead. */
export async function createSessionRecord(nguoiDungId: string): Promise<string> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_MAX_AGE_DAYS);
  const phien = await prisma.phienDangNhap.create({
    data: { nguoiDungId, expiresAt },
  });
  return phien.id;
}

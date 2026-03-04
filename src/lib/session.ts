import 'server-only';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

const SESSION_COOKIE_NAME = 'album_pulse_session';
const SESSION_MAX_AGE_DAYS = 7;

function getCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    secure: isProd,
    path: '/',
    maxAge: SESSION_MAX_AGE_DAYS * 24 * 60 * 60,
  };
}

export async function createSessionRecord(nguoiDungId: string): Promise<string> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_MAX_AGE_DAYS);

  const phien = await prisma.phienDangNhap.create({
    data: { nguoiDungId, expiresAt },
  });

  return phien.id;
}

export async function getSession(): Promise<{ nguoiDungId: string } | null> {
  const cookieStore = cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) return null;

  const phien = await prisma.phienDangNhap.findUnique({
    where: { id: sessionId },
    select: { nguoiDungId: true, expiresAt: true },
  });

  if (!phien || phien.expiresAt < new Date()) return null;
  return { nguoiDungId: phien.nguoiDungId };
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE_NAME;
}

export function getSessionCookieOptions(): ReturnType<typeof getCookieOptions> {
  return getCookieOptions();
}

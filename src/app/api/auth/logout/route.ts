import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/session';

// JSON logout for API / client-side usage.
export async function POST() {
  const res = NextResponse.json({ ok: true });
  await clearSessionCookie(res);
  return res;
}

// Simple browser-friendly logout: visit /api/auth/logout directly.
export async function GET(request: Request) {
  const res = NextResponse.redirect(new URL('/', request.url));
  await clearSessionCookie(res);
  return res;
}

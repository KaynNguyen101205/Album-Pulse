import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'album_pulse_session';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected =
    pathname === '/onboarding' ||
    pathname.startsWith('/onboarding/') ||
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname === '/favorites' ||
    pathname.startsWith('/favorites/') ||
    pathname === '/weekly-drop' ||
    pathname.startsWith('/weekly-drop/');

  if (!isProtected) return NextResponse.next();

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  if (!sessionCookie?.value) {
    return NextResponse.redirect(new URL('/api/auth/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/onboarding',
    '/onboarding/:path*',
    '/dashboard',
    '/dashboard/:path*',
    '/favorites',
    '/favorites/:path*',
    '/weekly-drop',
    '/weekly-drop/:path*',
  ],
};

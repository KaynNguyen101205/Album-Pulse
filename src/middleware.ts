import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected =
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/favorites') ||
    pathname.startsWith('/weekly-drop');

  if (!isProtected) return NextResponse.next();

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
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

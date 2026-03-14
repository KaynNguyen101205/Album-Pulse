import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isLoginPage = pathname === '/login';
  const isProtected =
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/favorites') ||
    pathname.startsWith('/weekly-drop');

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Already signed in: redirect away from login to dashboard (or callbackUrl)
  if (isLoginPage && token) {
    const callbackUrl = request.nextUrl.searchParams.get('callbackUrl');
    const destination =
      callbackUrl && callbackUrl.startsWith('/') && !callbackUrl.startsWith('//')
        ? callbackUrl
        : '/dashboard';
    return NextResponse.redirect(new URL(destination, request.url));
  }

  if (!isProtected) return NextResponse.next();

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/login',
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

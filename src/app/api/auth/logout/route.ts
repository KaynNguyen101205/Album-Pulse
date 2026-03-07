import { NextResponse } from 'next/server';

/** Redirect to NextAuth signout so the session is cleared. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const callbackUrl = url.searchParams.get('callbackUrl') ?? '/';
  return NextResponse.redirect(
    new URL(`/api/auth/signout?callbackUrl=${encodeURIComponent(callbackUrl)}`, url.origin)
  );
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const callbackUrl = url.searchParams.get('callbackUrl') ?? '/';
  return NextResponse.redirect(
    new URL(`/api/auth/signout?callbackUrl=${encodeURIComponent(callbackUrl)}`, url.origin)
  );
}

import 'server-only';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';

/** Returns the current user id if the NextAuth session is valid, otherwise null. */
export async function getSessionUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
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

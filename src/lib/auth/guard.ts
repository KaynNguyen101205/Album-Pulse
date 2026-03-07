/**
 * Auth guards for API routes.
 * Use requireAuth() to get userId or a 401 response with consistent error shape.
 */

import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/session';
import { unauthorized } from '@/lib/api/errors';

export type AuthResult = string | NextResponse;

/**
 * Returns the current user id, or a 401 JSON response with consistent error shape.
 * Use: const auth = await requireAuth(); if (auth instanceof NextResponse) return auth; const userId = auth;
 */
export async function requireAuth(): Promise<AuthResult> {
  const userId = await getSessionUserId();
  if (userId === null) {
    return unauthorized();
  }
  return userId;
}

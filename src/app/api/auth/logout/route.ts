import { NextResponse } from 'next/server';

// Placeholder logout route for clearing Spotify session/tokens.
// Replace with real implementation when wiring up auth.
export async function POST() {
  return NextResponse.json({
    ok: true,
    message: 'Auth logout endpoint is not implemented yet.',
  });
}

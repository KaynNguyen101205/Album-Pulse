import { NextResponse } from 'next/server';

// Placeholder login route for starting the Spotify OAuth flow.
// Replace with real implementation when wiring up auth.
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'Auth login endpoint is not implemented yet.',
  });
}

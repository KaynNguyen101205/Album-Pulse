import { NextResponse } from 'next/server';

// Placeholder callback route for Spotify OAuth.
// Replace with real implementation when wiring up auth.
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'Auth callback endpoint is not implemented yet.',
  });
}

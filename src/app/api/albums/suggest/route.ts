import { NextResponse } from 'next/server';

// Placeholder route to keep the file a valid module.
// Replace this with the real album suggestion implementation later.
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'Album suggestions endpoint is not implemented yet.',
  });
}

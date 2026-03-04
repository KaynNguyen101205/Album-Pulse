import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';

export async function GET() {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  return NextResponse.json({
    ok: true,
    message: 'Album suggestions endpoint is not implemented yet.',
    userId,
  });
}

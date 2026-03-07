import { NextRequest, NextResponse } from 'next/server';
import { generateWeeklyDropForUser } from '@/server/services/generateWeeklyDrop';

/**
 * Dev/admin only: regenerate weekly drop for a user.
 * - Body: { userId: string, force?: boolean }
 * - force: if true, replace existing drop for the current week; otherwise idempotent (no duplicate).
 * Production: guard with ADMIN_API_KEY or similar; this route checks NODE_ENV for MVP.
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    const key = request.headers.get('x-admin-key');
    const expected = process.env.ADMIN_API_KEY;
    if (!expected || key !== expected) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }

  let body: { userId?: string; force?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'bad_request', message: 'Invalid JSON body.' } },
      { status: 400 }
    );
  }

  const userId = body?.userId?.trim();
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'bad_request', message: 'Missing or empty userId in body.' } },
      { status: 400 }
    );
  }

  const result = await generateWeeklyDropForUser(userId, {
    force: Boolean(body.force),
  });

  if (!result.ok) {
    const failure = result as { ok: false; error: string };
    return NextResponse.json(
      { ok: false, error: failure.error },
      { status: 200 }
    );
  }

  return NextResponse.json({
    ok: true,
    weeklyDropId: result.weeklyDropId,
    weekKey: result.weekKey,
    generated: result.generated,
    ...(result.generated === false && { reason: result.reason }),
  });
}

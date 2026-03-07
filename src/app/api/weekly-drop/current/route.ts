import { NextResponse } from 'next/server';
import {
  NotLoggedInError,
  getCurrentWeeklyDrop,
} from '@/server/services/weekly-drop.service';
import { unauthorized, internalError } from '@/lib/api/errors';
import type { WeeklyDropDTO } from '@/lib/dto';

export const dynamic = 'force-dynamic';

/**
 * GET /api/weekly-drop/current
 * Returns the current week's weekly drop for the authenticated user.
 */
export async function GET() {
  try {
    const drop = await getCurrentWeeklyDrop();
    const dto: { ok: true; drop: WeeklyDropDTO } = {
      ok: true,
      drop: drop as WeeklyDropDTO,
    };
    return NextResponse.json(dto);
  } catch (error) {
    if (error instanceof NotLoggedInError) {
      return unauthorized();
    }
    console.error('[api/weekly-drop/current]', error);
    return internalError();
  }
}

import { NextResponse } from 'next/server';
import {
  NotLoggedInError,
  WeeklyDropNotFoundError,
  getWeeklyDropHistoryDetail,
} from '@/server/services/weekly-drop.service';
import { dropIdParamSchema } from '@/lib/validation/schemas';
import { parseWithSchema } from '@/lib/validation/parse';
import { unauthorized, notFound, internalError } from '@/lib/api/errors';
import type { WeeklyDropDTO } from '@/lib/dto';

/**
 * GET /api/weekly-drop/history/:dropId
 * Returns a single past weekly drop by id (owner only).
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ dropId: string }> | { dropId: string } }
) {
  const params = typeof context.params === 'object' && 'then' in context.params
    ? await context.params
    : context.params;
  const parsed = parseWithSchema(dropIdParamSchema, params);
  if (!parsed.ok) return parsed.response;
  const { dropId } = parsed.data;

  try {
    const drop = await getWeeklyDropHistoryDetail(dropId);
    return NextResponse.json({ ok: true, drop: drop as WeeklyDropDTO });
  } catch (error) {
    if (error instanceof NotLoggedInError) return unauthorized();
    if (error instanceof WeeklyDropNotFoundError) return notFound('Weekly drop not found.');
    console.error('[api/weekly-drop/history/[dropId]]', error);
    return internalError();
  }
}

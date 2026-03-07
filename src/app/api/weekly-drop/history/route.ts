import { NextResponse } from 'next/server';
import {
  NotLoggedInError,
  getWeeklyDropHistory,
} from '@/server/services/weekly-drop.service';
import { weeklyDropHistoryQuerySchema } from '@/lib/validation/schemas';
import { parseWithSchema } from '@/lib/validation/parse';
import { unauthorized, internalError } from '@/lib/api/errors';
import type { WeeklyDropHistoryResponseDTO } from '@/lib/dto';

/**
 * GET /api/weekly-drop/history
 * Paginated list of past weekly drops for the authenticated user.
 * Query: limit (1–30), cursor (optional).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const queryInput = {
    limit: searchParams.get('limit') ?? undefined,
    cursor: searchParams.get('cursor') ?? undefined,
  };
  const parsed = parseWithSchema(weeklyDropHistoryQuerySchema, queryInput);
  if (parsed.ok === false) return parsed.response;

  try {
    const result = await getWeeklyDropHistory({
      limit: parsed.data.limit,
      cursor: parsed.data.cursor ?? undefined,
    });
    const dto: WeeklyDropHistoryResponseDTO = {
      ok: true,
      entries: result.entries,
      nextCursor: result.nextCursor,
      meta: { limit: parsed.data.limit },
    };
    return NextResponse.json(dto);
  } catch (error) {
    if (error instanceof NotLoggedInError) {
      return unauthorized();
    }
    console.error('[api/weekly-drop/history]', error);
    return internalError();
  }
}

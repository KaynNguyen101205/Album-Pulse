import { NextResponse } from 'next/server';
import {
  FeedbackLockedError,
  FeedbackValidationError,
  NotLoggedInError,
  WeeklyDropItemNotFoundError,
  updateWeeklyDropItemFeedback,
} from '@/server/services/weekly-drop.service';
import { itemIdParamSchema, weeklyDropFeedbackPatchSchema } from '@/lib/validation/schemas';
import { parseWithSchema } from '@/lib/validation/parse';
import {
  badRequest,
  unauthorized,
  notFound,
  validationError,
  internalError,
} from '@/lib/api/errors';
import type { FeedbackResponseDTO } from '@/lib/dto';

/**
 * PATCH /api/weekly-drop/items/:itemId/feedback
 * Update feedback (like/dislike/skip/save/rating/review) for a weekly drop item.
 * Only the owner can update; only current week's drop is editable.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ itemId: string }> | { itemId: string } }
) {
  const params = typeof context.params === 'object' && 'then' in context.params
    ? await context.params
    : context.params;
  const paramParsed = parseWithSchema(itemIdParamSchema, params);
  if (!paramParsed.ok) return paramParsed.response;
  const { itemId } = paramParsed.data;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body.');
  }
  const bodyParsed = parseWithSchema(weeklyDropFeedbackPatchSchema, body);
  if (!bodyParsed.ok) return bodyParsed.response;
  const patch = bodyParsed.data;

  try {
    const feedback = await updateWeeklyDropItemFeedback(itemId, patch);
    const dto: FeedbackResponseDTO = { ok: true, feedback };
    return NextResponse.json(dto);
  } catch (error) {
    if (error instanceof NotLoggedInError) return unauthorized();
    if (error instanceof WeeklyDropItemNotFoundError) return notFound('Weekly drop item not found.');
    if (error instanceof FeedbackLockedError) {
      return validationError(error.message);
    }
    if (error instanceof FeedbackValidationError) {
      return validationError(error.message);
    }
    console.error('[api/weekly-drop/items/feedback]', error);
    return internalError();
  }
}

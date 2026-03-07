import { NextResponse } from 'next/server';

import type { WeeklyDropFeedbackPatch } from '@/types/weekly-drop';
import {
  FeedbackLockedError,
  FeedbackValidationError,
  NotLoggedInError,
  WeeklyDropItemNotFoundError,
  updateWeeklyDropItemFeedback,
} from '@/server/services/weekly-drop.service';

function parseBody(body: unknown): WeeklyDropFeedbackPatch | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  return body as WeeklyDropFeedbackPatch;
}

export async function PATCH(
  request: Request,
  context: { params: { itemId: string } }
) {
  try {
    const itemId = context.params.itemId;
    if (!itemId?.trim()) {
      return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    }

    const patch = parseBody(rawBody);
    if (!patch) {
      return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    }

    const feedback = await updateWeeklyDropItemFeedback(itemId, patch);
    return NextResponse.json({ ok: true, feedback });
  } catch (error) {
    if (error instanceof NotLoggedInError) {
      return NextResponse.json({ error: 'not_logged_in' }, { status: 401 });
    }
    if (error instanceof WeeklyDropItemNotFoundError) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    if (error instanceof FeedbackLockedError) {
      return NextResponse.json(
        { error: 'feedback_locked', message: error.message },
        { status: 400 }
      );
    }
    if (error instanceof FeedbackValidationError) {
      return NextResponse.json(
        { error: 'invalid_feedback', message: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'unexpected', message: String(error) },
      { status: 500 }
    );
  }
}

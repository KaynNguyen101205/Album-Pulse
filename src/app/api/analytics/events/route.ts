import { NextResponse } from 'next/server';
import {
  AnalyticsAuthError,
  AnalyticsValidationError,
  createAnalyticsEvent,
} from '@/server/services/analytics.service';
import { analyticsEventBodySchema } from '@/lib/validation/schemas';
import { parseWithSchema } from '@/lib/validation/parse';
import { unauthorized, validationError, internalError } from '@/lib/api/errors';
import type { EventTrackingResponseDTO } from '@/lib/dto';
import type { AnalyticsEventPayload } from '@/types/weekly-drop';

/**
 * POST /api/analytics/events
 * Track user events (e.g. view_weekly_drop, click_item). Body: { eventName, weeklyDropId?, weeklyDropItemId?, metadata? }.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const parsed = parseWithSchema<typeof analyticsEventBodySchema>(analyticsEventBodySchema, {});
    if (parsed.ok === false) return parsed.response;
    return validationError('Invalid JSON body.', { fieldErrors: {}, formErrors: [] });
  }
  const parsed = parseWithSchema<typeof analyticsEventBodySchema>(analyticsEventBodySchema, body);
  if (parsed.ok === false) return parsed.response;

  try {
    const { eventName, weeklyDropId, weeklyDropItemId, metadata } = parsed.data;
    if (!eventName) {
      return validationError('Validation failed.', {
        fieldErrors: { eventName: ['eventName is required.'] },
        formErrors: [],
      });
    }
    const payload: AnalyticsEventPayload = {
      eventName,
      weeklyDropId: weeklyDropId ?? null,
      weeklyDropItemId: weeklyDropItemId ?? null,
      metadata: metadata ?? null,
    };
    await createAnalyticsEvent(payload);
    const dto: EventTrackingResponseDTO = { ok: true };
    return NextResponse.json(dto);
  } catch (error) {
    if (error instanceof AnalyticsAuthError) return unauthorized();
    if (error instanceof AnalyticsValidationError) return validationError(error.message);
    console.error('[api/analytics/events]', error);
    return internalError();
  }
}

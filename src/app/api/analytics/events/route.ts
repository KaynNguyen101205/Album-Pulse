import { NextResponse } from 'next/server';

import {
  AnalyticsAuthError,
  AnalyticsValidationError,
  createAnalyticsEvent,
} from '@/server/services/analytics.service';
import type { AnalyticsEventPayload } from '@/types/weekly-drop';

function parseBody(body: unknown): AnalyticsEventPayload | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  return body as AnalyticsEventPayload;
}

export async function POST(request: Request) {
  try {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    }

    const body = parseBody(rawBody);
    if (!body) {
      return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    }

    await createAnalyticsEvent(body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AnalyticsAuthError) {
      return NextResponse.json({ error: 'not_logged_in' }, { status: 401 });
    }

    if (error instanceof AnalyticsValidationError) {
      return NextResponse.json(
        { error: 'invalid_payload', message: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'unexpected', message: String(error) },
      { status: 500 }
    );
  }
}

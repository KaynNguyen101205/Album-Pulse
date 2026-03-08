import { NextResponse } from 'next/server';

import { forbidden, internalError, unauthorized } from '@/lib/api/errors';
import { getSessionUserId } from '@/lib/session';
import { parseWithSchema } from '@/lib/validation/parse';
import { weeklyDropMetricsQuerySchema } from '@/lib/validation/schemas';
import { getWeeklyDropMetricsSummary } from '@/server/services/weeklyDropMetrics.service';
import type { WeeklyDropMetricsSummaryDTO } from '@/lib/dto';

/**
 * GET /api/weekly-drop/metrics?weeks=<n>&userId=<optional>
 * Internal summary endpoint for weekly feedback-loop metrics.
 */
export async function GET(request: Request) {
  const sessionUserId = await getSessionUserId();
  if (!sessionUserId) {
    return unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const parsed = parseWithSchema(weeklyDropMetricsQuerySchema, {
    weeks: searchParams.get('weeks') ?? undefined,
    userId: searchParams.get('userId') ?? undefined,
  });
  if (parsed.ok === false) return parsed.response;

  const requestedUserId = parsed.data.userId ?? sessionUserId;
  if (requestedUserId !== sessionUserId) {
    return forbidden('You can only view your own metrics.');
  }

  try {
    const summary = await getWeeklyDropMetricsSummary({
      userId: requestedUserId,
      weeks: parsed.data.weeks,
    });
    const dto: WeeklyDropMetricsSummaryDTO = {
      ok: true,
      weeks: parsed.data.weeks,
      userMetrics: summary.userMetrics,
      globalMetrics: summary.globalMetrics,
      comparisons: summary.comparisons,
    };
    return NextResponse.json(dto);
  } catch (error) {
    console.error('[api/weekly-drop/metrics]', error);
    return internalError();
  }
}

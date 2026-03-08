import {
  generateWeeklyDropForUser,
  logGenerationStart,
  logGenerationEnd,
} from '@/server/services/generateWeeklyDrop';
import { getCurrentWeekStartUTC, getWeekKey } from '@/server/scheduler/weekUtils';
import { getActiveUserIds } from '@/server/scheduler/activeUsers';
import { recomputeUserPreferenceProfile } from '@/server/services/recomputeUserProfile';
import { recomputeWeeklyMetricsForWeek } from '@/server/services/weeklyDropMetrics.service';

const LOG_PREFIX = '[weeklyDropCron]';

/**
 * Weekly drop cron entrypoint: run for the current week (Monday 00:00 UTC).
 * Prefer running Mondays at 09:00 system time (or user timezone when supported).
 * - Generates one drop per active user for the current week (idempotent).
 * - Skips inactive users (no session in last INACTIVE_DAYS).
 * Safe for serverless: run this from a cron trigger or scheduled job.
 */
export async function runWeeklyDropCron(): Promise<{
  weekKey: string;
  activeUserCount: number;
  generated: number;
  skipped: number;
  failed: number;
}> {
  const weekStart = getCurrentWeekStartUTC();
  const weekKey = getWeekKey(weekStart);

  console.info(`${LOG_PREFIX} start weekKey=${weekKey}`);

  const userIds = await getActiveUserIds();
  let recomputeFailed = 0;
  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const userId of userIds) {
    const recomputeResult = await recomputeUserPreferenceProfile(userId, { weekStart });
    if (!recomputeResult.ok) {
      recomputeFailed += 1;
      console.warn(
        `${LOG_PREFIX} recompute_failed userId=${userId} weekKey=${weekKey} error=${recomputeResult.error ?? 'unknown'}`
      );
    }

    logGenerationStart(userId, weekKey);
    const result = await generateWeeklyDropForUser(userId, { weekStart });
    logGenerationEnd(userId, weekKey, result);

    if (result.ok === false) {
      failed += 1;
      continue;
    }
    if (result.generated) generated += 1;
    else skipped += 1;
  }

  const previousWeekStart = new Date(weekStart.getTime());
  previousWeekStart.setUTCDate(previousWeekStart.getUTCDate() - 7);
  try {
    await recomputeWeeklyMetricsForWeek(previousWeekStart, userIds);
  } catch (error) {
    console.error(`${LOG_PREFIX} metrics_recompute_failed weekKey=${weekKey}`, error);
  }

  console.info(
    `${LOG_PREFIX} end weekKey=${weekKey} activeUsers=${userIds.length} recomputeFailed=${recomputeFailed} generated=${generated} skipped=${skipped} failed=${failed}`
  );

  return {
    weekKey,
    activeUserCount: userIds.length,
    generated,
    skipped,
    failed,
  };
}

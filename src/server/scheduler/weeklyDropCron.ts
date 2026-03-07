import {
  generateWeeklyDropForUser,
  logGenerationStart,
  logGenerationEnd,
} from '@/server/services/generateWeeklyDrop';
import { getCurrentWeekStartUTC, getWeekKey } from '@/server/scheduler/weekUtils';
import { getActiveUserIds } from '@/server/scheduler/activeUsers';

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
  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const userId of userIds) {
    logGenerationStart(userId, weekKey);
    const result = await generateWeeklyDropForUser(userId, { weekStart });
    logGenerationEnd(userId, weekKey, result);

    if (!result.ok) {
      failed += 1;
      continue;
    }
    if (result.generated) generated += 1;
    else skipped += 1;
  }

  console.info(
    `${LOG_PREFIX} end weekKey=${weekKey} activeUsers=${userIds.length} generated=${generated} skipped=${skipped} failed=${failed}`
  );

  return {
    weekKey,
    activeUserCount: userIds.length,
    generated,
    skipped,
    failed,
  };
}

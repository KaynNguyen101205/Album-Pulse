/**
 * Week boundaries and keys for weekly drops.
 * Week = Monday 00:00 UTC (stable for cron and serverless).
 * Structure is ready for per-user timezone later (pass tz to getWeekStartForDate).
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Get Monday 00:00:00.000 UTC for the week containing the given date.
 */
export function getWeekStartMondayUTC(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + mondayOffset);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Stable string key for a week (YYYY-MM-DD of Monday UTC).
 */
export function getWeekKey(weekStart: Date): string {
  const y = weekStart.getUTCFullYear();
  const m = String(weekStart.getUTCMonth() + 1).padStart(2, '0');
  const d = String(weekStart.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Current week start (Monday 00:00 UTC) for "now".
 */
export function getCurrentWeekStartUTC(): Date {
  return getWeekStartMondayUTC(new Date());
}

/**
 * End of the active window: weekStart + 7 days (next Monday 00:00 UTC exclusive).
 * The list is frozen until this date.
 */
export function getFrozenUntil(weekStart: Date): Date {
  const end = new Date(weekStart.getTime());
  end.setUTCDate(end.getUTCDate() + 7);
  return end;
}

/**
 * Parse a week key (YYYY-MM-DD) back to a Date (Monday 00:00 UTC).
 */
export function parseWeekKey(weekKey: string): Date {
  const [y, m, d] = weekKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

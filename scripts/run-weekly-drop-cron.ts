/**
 * Entrypoint for weekly drop cron/scheduled job.
 * Run: npx tsx scripts/run-weekly-drop-cron.ts
 * Schedule: e.g. Mondays 09:00 (system timezone); or use your platform's cron (Vercel Cron, etc.).
 */
import 'dotenv/config';
import { runWeeklyDropCron } from '../src/server/scheduler/weeklyDropCron';

runWeeklyDropCron()
  .then((r) => {
    console.info('Cron result:', r);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Cron failed:', err);
    process.exit(1);
  });

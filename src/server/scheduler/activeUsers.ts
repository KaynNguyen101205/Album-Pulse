import { prisma } from '@/lib/prisma';

/**
 * Consider a user "inactive" if they have no session that was still valid
 * at any point in the last INACTIVE_DAYS days. Easy to change for different policies.
 */
export const INACTIVE_DAYS = 56;

/**
 * Returns user IDs that are "active" for scheduled weekly drop generation:
 * have at least one session with expiresAt >= (now - INACTIVE_DAYS).
 * Inactive users are skipped by the cron; they can get a drop on-demand when they return.
 */
export async function getActiveUserIds(): Promise<string[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - INACTIVE_DAYS);

  const rows = await prisma.session.findMany({
    where: { expiresAt: { gte: cutoff } },
    select: { userId: true },
    distinct: ['userId'],
  });
  return rows.map((r) => r.userId);
}

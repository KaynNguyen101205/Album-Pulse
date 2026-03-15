import { prisma } from '@/lib/prisma';
import { generateCandidatesForUser } from '@/server/recs/candidateGenerator';
import { getRankingContextForUser } from '@/server/recs/getRankingContext';
import { rankAlbums } from '@/server/recs/scoring/rankAlbums';
import { RECOMMENDATIONS_COUNT } from '@/server/recs/scoring/config';
import {
  getCurrentWeekStartUTC,
  getWeekKey,
  getFrozenUntil,
} from '@/server/scheduler/weekUtils';

const LOG_PREFIX = '[generateWeeklyDrop]';

export type GenerateWeeklyDropOptions = {
  /** If true, delete existing drop for (user, week) and create a new one. */
  force?: boolean;
  /** Week to generate for; default = current week (Monday UTC). */
  weekStart?: Date;
};

export type GenerateWeeklyDropResult =
  | { ok: true; weeklyDropId: string; weekKey: string; generated: true }
  | { ok: true; weeklyDropId: string; weekKey: string; generated: false; reason: string }
  | { ok: false; error: string };

/**
 * Idempotent: creates one WeeklyDrop per user per week. Re-running the same week
 * for the same user does not create a duplicate unless force is true.
 * Uses a transaction for WeeklyDrop + WeeklyDropItem writes.
 */
export async function generateWeeklyDropForUser(
  userId: string,
  options: GenerateWeeklyDropOptions = {}
): Promise<GenerateWeeklyDropResult> {
  const weekStart = options.weekStart ?? getCurrentWeekStartUTC();
  const weekKey = getWeekKey(weekStart);
  const frozenUntil = getFrozenUntil(weekStart);

  try {
    const favoriteCount = await prisma.userFavoriteAlbum.count({ where: { userId } });
    console.info(`${LOG_PREFIX} start userId=${userId} weekKey=${weekKey} favoriteCount=${favoriteCount}`);

    const existing = await prisma.weeklyDrop.findUnique({
      where: { userId_weekStart: { userId, weekStart } },
      select: { id: true, status: true },
    });

    if (existing && !options.force) {
      return {
        ok: true,
        weeklyDropId: existing.id,
        weekKey,
        generated: false,
        reason: 'already_exists',
      };
    }

    const context = await getRankingContextForUser(userId);
    const candidates = await generateCandidatesForUser(userId, {
      suppressedAlbumIds: Object.keys(context.suppressionByAlbum ?? {}),
      suppressedArtistNames: Object.keys(context.suppressionByArtist ?? {}),
      suppressedTags: Object.keys(context.suppressionByTag ?? {}),
      recentArtistCounts: context.recentArtistCounts ?? {},
    });

    if (candidates.length === 0) {
      console.warn(`${LOG_PREFIX} no_candidates userId=${userId} weekKey=${weekKey}`);
      return {
        ok: false,
        error: 'no_candidates',
      };
    }

    const recommendations = rankAlbums(candidates, context);
    const toPersist = recommendations.slice(0, RECOMMENDATIONS_COUNT);
    if (toPersist.length === 0) {
      return { ok: false, error: 'no_recommendations_after_ranking' };
    }

    const generatedAt = new Date();
    const weeklyDropId = crypto.randomUUID();

    await prisma.$transaction(async (tx) => {
      if (existing && options.force) {
        await tx.weeklyDropItem.deleteMany({ where: { weeklyDropId: existing.id } });
        await tx.weeklyDrop.delete({ where: { id: existing.id } });
      }

      await tx.weeklyDrop.create({
        data: {
          id: weeklyDropId,
          userId,
          weekStart,
          frozenUntil,
          generatedAt,
          status: 'ACTIVE',
        },
      });

      await tx.weeklyDropItem.createMany({
        data: toPersist.map((rec, idx) => ({
          id: crypto.randomUUID(),
          weeklyDropId,
          albumId: rec.albumId,
          rank: idx + 1,
          reason: {
            short: rec.explanation.short,
            reasons: rec.explanation.reasons,
            matchedPreferences: rec.explanation.matchedPreferences,
          } as object,
        })),
      });
    });

    return {
      ok: true,
      weeklyDropId,
      weekKey,
      generated: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/**
 * Log helper for cron/jobs: log start, success, or failure with user id and week key.
 */
export function logGenerationStart(userId: string, weekKey: string): void {
  console.info(`${LOG_PREFIX} start userId=${userId} weekKey=${weekKey}`);
}

export function logGenerationEnd(
  userId: string,
  weekKey: string,
  result: GenerateWeeklyDropResult
): void {
  if (result.ok === false) {
    console.warn(`${LOG_PREFIX} failure userId=${userId} weekKey=${weekKey} error=${result.error}`);
  } else {
    console.info(
      `${LOG_PREFIX} end userId=${userId} weekKey=${weekKey} generated=${result.generated}${result.generated === false ? ` reason=${result.reason}` : ''}`
    );
  }
}

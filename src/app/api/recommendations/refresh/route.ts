import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { generateWeeklyDropForUser } from '@/server/services/generateWeeklyDrop';
import { unauthorized, internalError } from '@/lib/api/errors';

/**
 * POST /api/recommendations/refresh
 * Force-regenerates the current week's Weekly Drop for the authenticated user.
 * Use this when the user clicks "Refresh recommendations" so the dashboard
 * can refetch and show new hidden-gem picks.
 */
export async function POST() {
  try {
    const auth = await requireSession();
    if (auth instanceof NextResponse) return auth;
    const userId = auth;

    const result = await generateWeeklyDropForUser(userId, { force: true });

    if (result.ok === false) {
      return NextResponse.json(
        { ok: false, error: result.error, message: result.error === 'no_candidates' ? 'No similar albums in catalog. Add more favorites or try different artists.' : result.error },
        { status: 200 }
      );
    }

    return NextResponse.json({
      ok: true,
      generated: result.generated,
      weeklyDropId: result.weeklyDropId,
      weekKey: result.weekKey,
    });
  } catch (error) {
    console.error('[api/recommendations/refresh]', error);
    return internalError();
  }
}

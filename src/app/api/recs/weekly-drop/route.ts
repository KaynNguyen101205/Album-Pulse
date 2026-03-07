import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/session';
import { generateCandidatesForUser } from '@/server/recs/candidateGenerator';
import { getRankingContextForUser } from '@/server/recs/getRankingContext';
import { rankAlbums } from '@/server/recs/scoring/rankAlbums';
import { getCurrentWeeklyDrop } from '@/server/services/getCurrentWeeklyDrop';
import { generateWeeklyDropForUser } from '@/server/services/generateWeeklyDrop';

type ErrorBody = {
  error: { code: string; message: string; details?: unknown };
};

function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: unknown
) {
  return NextResponse.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status }
  );
}

/**
 * GET: Return the current week's persisted weekly drop for the logged-in user.
 * If none exists (new user or returning inactive), generates one on-demand then returns it.
 */
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return errorResponse(401, 'not_logged_in', 'You must be logged in to view your weekly drop.');
  }

  let drop = await getCurrentWeeklyDrop(userId);
  if (!drop) {
    const result = await generateWeeklyDropForUser(userId);
    if (result.ok === false) {
      return NextResponse.json(
        {
          weeklyDrop: null,
          meta: { generated: false, error: result.error },
        },
        { status: 200 }
      );
    }
    drop = await getCurrentWeeklyDrop(userId);
  }

  if (!drop) {
    return NextResponse.json({
      weeklyDrop: null,
      meta: { generated: false },
    });
  }

  return NextResponse.json({
    weeklyDrop: {
      id: drop.id,
      weekStart: drop.weekStart.toISOString().slice(0, 10),
      frozenUntil: drop.frozenUntil?.toISOString().slice(0, 10) ?? null,
      generatedAt: drop.generatedAt?.toISOString() ?? null,
      status: drop.status,
      items: drop.items.map((item) => ({
        albumId: item.albumId,
        rank: item.rank,
        reason: item.reason,
        album: item.album,
      })),
    },
    meta: { generated: true },
  });
}

export async function POST(request: NextRequest) {
  let body: { userId?: string; userPreferredTags?: string[] };
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, 'bad_request', 'Invalid JSON body.');
  }

  const userId = body?.userId?.trim();
  if (!userId) {
    return errorResponse(400, 'bad_request', 'Missing or empty userId in body.');
  }

  try {
    const [candidates, context] = await Promise.all([
      generateCandidatesForUser(userId, {
        userPreferredTags: body.userPreferredTags,
      }),
      getRankingContextForUser(userId),
    ]);

    if (candidates.length === 0) {
      return NextResponse.json({
        recommendations: [],
        meta: { count: 0, message: 'Not enough candidates. Add more favorites or albums.' },
      });
    }

    const recommendations = rankAlbums(candidates, context);

    return NextResponse.json({
      recommendations,
      meta: {
        count: recommendations.length,
        candidatePoolSize: candidates.length,
      },
    });
  } catch (err) {
    console.error('[api/recs/weekly-drop] unexpected_error', err);
    return errorResponse(500, 'internal_error', 'Unexpected server error.');
  }
}

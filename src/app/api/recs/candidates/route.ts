import { NextRequest, NextResponse } from 'next/server';
import { generateCandidatesForUser } from '@/server/recs/candidateGenerator';

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

const RESPONSE_CANDIDATE_LIMIT = 50;

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

  const debug = request.nextUrl.searchParams.get('debug') === '1';

  try {
    const candidates = await generateCandidatesForUser(userId, {
      userPreferredTags: body.userPreferredTags,
    });

    const count = candidates.length;
    const truncated = candidates.slice(0, RESPONSE_CANDIDATE_LIMIT);

    const response: {
      count: number;
      candidates: typeof truncated;
      debug?: { total: number; truncatedTo: number };
    } = {
      count,
      candidates: truncated,
    };

    if (debug) {
      response.debug = {
        total: count,
        truncatedTo: RESPONSE_CANDIDATE_LIMIT,
      };
      truncated.forEach((c) => {
        (c as Record<string, unknown>).sources = c.sources;
        (c as Record<string, unknown>).rawSignals = c.rawSignals;
      });
    } else {
      truncated.forEach((c) => {
        delete (c as Record<string, unknown>).rawSignals;
      });
    }

    return NextResponse.json(response);
  } catch (err) {
    console.error('[api/recs/candidates] unexpected_error', err);
    return errorResponse(500, 'internal_error', 'Unexpected server error.');
  }
}

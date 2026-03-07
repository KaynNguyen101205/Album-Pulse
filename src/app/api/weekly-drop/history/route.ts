import { NextResponse } from 'next/server';

import {
  NotLoggedInError,
  getWeeklyDropHistory,
} from '@/server/services/weekly-drop.service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const cursor = searchParams.get('cursor');
    const limit =
      typeof limitParam === 'string' && limitParam.trim()
        ? Number.parseInt(limitParam, 10)
        : undefined;

    const result = await getWeeklyDropHistory({
      limit,
      cursor,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof NotLoggedInError) {
      return NextResponse.json({ error: 'not_logged_in' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'unexpected', message: String(error) },
      { status: 500 }
    );
  }
}

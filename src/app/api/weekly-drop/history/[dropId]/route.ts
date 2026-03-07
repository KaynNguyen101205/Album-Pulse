import { NextResponse } from 'next/server';

import {
  NotLoggedInError,
  WeeklyDropNotFoundError,
  getWeeklyDropHistoryDetail,
} from '@/server/services/weekly-drop.service';

export async function GET(
  _request: Request,
  context: { params: { dropId: string } }
) {
  try {
    const drop = await getWeeklyDropHistoryDetail(context.params.dropId);
    return NextResponse.json({ ok: true, drop });
  } catch (error) {
    if (error instanceof NotLoggedInError) {
      return NextResponse.json({ error: 'not_logged_in' }, { status: 401 });
    }

    if (error instanceof WeeklyDropNotFoundError) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'unexpected', message: String(error) },
      { status: 500 }
    );
  }
}

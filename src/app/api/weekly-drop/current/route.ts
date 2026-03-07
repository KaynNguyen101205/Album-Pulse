import { NextResponse } from 'next/server';

import {
  NotLoggedInError,
  getCurrentWeeklyDrop,
} from '@/server/services/weekly-drop.service';

export async function GET() {
  try {
    const drop = await getCurrentWeeklyDrop();

    return NextResponse.json({
      ok: true,
      drop,
    });
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

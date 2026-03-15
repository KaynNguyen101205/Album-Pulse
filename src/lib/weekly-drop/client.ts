import type {
  WeeklyDrop,
  WeeklyDropFeedback,
  WeeklyDropFeedbackPatch,
  WeeklyDropHistoryPage,
} from '@/types/weekly-drop';

type CurrentDropResponse = {
  drop?: WeeklyDrop | null;
  hasFavorites?: boolean;
  error?: string;
  message?: string;
};

type FeedbackResponse = {
  feedback?: WeeklyDropFeedback;
  error?: string;
  message?: string;
};

type HistoryResponse = WeeklyDropHistoryPage & {
  error?: string;
  message?: string;
};

type HistoryDetailResponse = {
  drop?: WeeklyDrop;
  error?: string;
  message?: string;
};

function buildError(status: number, payload?: { error?: string; message?: string }): Error {
  if (status === 401) return new Error('Your session expired. Please sign in again.');
  return new Error(payload?.message ?? payload?.error ?? 'Request failed.');
}

export type CurrentWeeklyDropResult = {
  drop: WeeklyDrop | null;
  hasFavorites: boolean;
};

export async function fetchCurrentWeeklyDrop(
  signal?: AbortSignal
): Promise<CurrentWeeklyDropResult> {
  const response = await fetch('/api/weekly-drop/current', {
    method: 'GET',
    cache: 'no-store',
    signal,
  });
  const payload = (await response.json()) as CurrentDropResponse;

  if (!response.ok) {
    throw buildError(response.status, payload);
  }

  return {
    drop: payload.drop ?? null,
    hasFavorites: payload.hasFavorites === true,
  };
}

export async function patchWeeklyDropFeedback(
  itemId: string,
  patch: WeeklyDropFeedbackPatch
): Promise<WeeklyDropFeedback> {
  const response = await fetch(
    `/api/weekly-drop/items/${encodeURIComponent(itemId)}/feedback`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patch),
    }
  );

  const payload = (await response.json()) as FeedbackResponse;

  if (!response.ok || !payload.feedback) {
    throw buildError(response.status, payload);
  }

  return payload.feedback;
}

export async function fetchWeeklyDropHistory(
  input: { cursor?: string | null; limit?: number } = {}
): Promise<WeeklyDropHistoryPage> {
  const params = new URLSearchParams();
  if (typeof input.limit === 'number' && Number.isFinite(input.limit)) {
    params.set('limit', String(Math.floor(input.limit)));
  }
  if (input.cursor) params.set('cursor', input.cursor);

  const query = params.toString();
  const response = await fetch(`/api/weekly-drop/history${query ? `?${query}` : ''}`, {
    method: 'GET',
    cache: 'no-store',
  });
  const payload = (await response.json()) as HistoryResponse;

  if (!response.ok) {
    throw buildError(response.status, payload);
  }

  return {
    entries: Array.isArray(payload.entries) ? payload.entries : [],
    nextCursor: payload.nextCursor ?? null,
  };
}

export async function fetchWeeklyDropHistoryDetail(dropId: string): Promise<WeeklyDrop> {
  const response = await fetch(`/api/weekly-drop/history/${encodeURIComponent(dropId)}`, {
    method: 'GET',
    cache: 'no-store',
  });
  const payload = (await response.json()) as HistoryDetailResponse;

  if (!response.ok || !payload.drop) {
    throw buildError(response.status, payload);
  }

  return payload.drop;
}

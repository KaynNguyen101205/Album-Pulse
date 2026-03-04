import 'server-only';

const DEFAULT_HISTORY_LIMIT = 20;
const MAX_HISTORY_LIMIT = 50;

export type RecommendationRunsCursor = {
  createdAt: Date;
  id: string;
};

export class InvalidCursorError extends Error {
  constructor(message = 'Invalid runs cursor.') {
    super(message);
    this.name = 'InvalidCursorError';
  }
}

export function normalizeHistoryLimit(limit?: number | null): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) {
    return DEFAULT_HISTORY_LIMIT;
  }

  const normalized = Math.floor(limit);
  if (normalized < 1) return 1;
  if (normalized > MAX_HISTORY_LIMIT) return MAX_HISTORY_LIMIT;
  return normalized;
}

export function encodeRunsCursor(input: RecommendationRunsCursor): string {
  const payload = JSON.stringify({
    createdAt: input.createdAt.toISOString(),
    id: input.id,
  });
  return Buffer.from(payload, 'utf8').toString('base64url');
}

export function decodeRunsCursor(cursor: string): RecommendationRunsCursor {
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as { createdAt?: unknown; id?: unknown };

    if (typeof parsed.id !== 'string' || !parsed.id.trim()) {
      throw new InvalidCursorError();
    }

    if (typeof parsed.createdAt !== 'string') {
      throw new InvalidCursorError();
    }

    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
      throw new InvalidCursorError();
    }

    return { createdAt, id: parsed.id };
  } catch (err) {
    if (err instanceof InvalidCursorError) {
      throw err;
    }
    throw new InvalidCursorError();
  }
}

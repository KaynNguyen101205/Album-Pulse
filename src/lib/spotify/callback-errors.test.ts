import { describe, expect, it } from 'vitest';

import {
  buildFetchProfileFailedLogMeta,
  buildFetchProfileFailedPayload,
} from './callback-errors';
import { SpotifyApiError } from './types';

describe('callback profile error payload', () => {
  it('returns generic payload in production', () => {
    const error = new SpotifyApiError({
      code: 'unauthorized',
      status: 401,
      message: 'Unauthorized',
    });

    const payload = buildFetchProfileFailedPayload(error, true);
    expect(payload).toEqual({ error: 'FETCH_PROFILE_FAILED' });
  });

  it('returns safe detailed payload in development for SpotifyApiError', () => {
    const error = new SpotifyApiError({
      code: 'bad_request',
      status: 400,
      message: 'Bad Request',
    });

    const payload = buildFetchProfileFailedPayload(error, false);
    expect(payload.error).toBe('FETCH_PROFILE_FAILED');
    expect(payload.reason).toEqual({
      status: 400,
      code: 'bad_request',
      message: 'Bad Request',
    });
  });

  it('returns safe detailed payload in development for unknown errors', () => {
    const payload = buildFetchProfileFailedPayload(new Error('boom'), false);
    expect(payload).toEqual({
      error: 'FETCH_PROFILE_FAILED',
      reason: {
        message: 'boom',
      },
    });
  });

  it('builds log metadata for SpotifyApiError', () => {
    const error = new SpotifyApiError({
      code: 'rate_limited',
      status: 429,
      message: 'Too Many Requests',
      details: { retryAfter: 10 },
    });

    const meta = buildFetchProfileFailedLogMeta(error);
    expect(meta).toEqual({
      status: 429,
      code: 'rate_limited',
      message: 'Too Many Requests',
      details: { retryAfter: 10 },
    });
  });
});

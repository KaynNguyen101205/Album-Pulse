import { describe, expect, it } from 'vitest';

import {
  buildTokenExchangeFailedLogMeta,
  buildTokenExchangeFailedPayload,
  buildFetchProfileFailedLogMeta,
  buildFetchProfileFailedPayload,
  resolveFetchProfileFailedStatus,
  resolveTokenExchangeFailedStatus,
} from './callback-errors';
import { SpotifyOAuthError } from './oauth';
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

  it('maps fetch profile status: pass-through in dev, force 500 in prod', () => {
    const err = new SpotifyApiError({
      code: 'unauthorized',
      status: 401,
      message: 'Unauthorized',
    });

    expect(resolveFetchProfileFailedStatus(err, false)).toBe(401);
    expect(resolveFetchProfileFailedStatus(err, true)).toBe(500);
  });
});

describe('callback token exchange error payload', () => {
  it('returns generic payload in production', () => {
    const err = new SpotifyOAuthError('invalid_grant', 400, { error: 'invalid_grant' });
    expect(buildTokenExchangeFailedPayload(err, true)).toEqual({
      error: 'TOKEN_EXCHANGE_FAILED',
    });
    expect(resolveTokenExchangeFailedStatus(err, true)).toBe(401);
  });

  it('returns detailed payload and status in development', () => {
    const err = new SpotifyOAuthError('invalid_grant', 400, { error: 'invalid_grant' });

    expect(buildTokenExchangeFailedPayload(err, false)).toEqual({
      error: 'TOKEN_EXCHANGE_FAILED',
      reason: {
        status: 400,
        message: 'invalid_grant',
      },
    });
    expect(resolveTokenExchangeFailedStatus(err, false)).toBe(400);
  });

  it('builds token exchange log metadata', () => {
    const err = new SpotifyOAuthError('bad request', 400, { error: 'bad_request' });
    expect(buildTokenExchangeFailedLogMeta(err)).toEqual({
      status: 400,
      message: 'bad request',
      details: { error: 'bad_request' },
    });
  });
});

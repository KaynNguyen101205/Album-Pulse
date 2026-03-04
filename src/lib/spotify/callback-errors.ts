import 'server-only';

import { SpotifyApiError } from './types';

export type FetchProfileFailedPayload = {
  error: 'FETCH_PROFILE_FAILED';
  reason?: {
    status?: number;
    code?: string;
    message: string;
  };
};

export function buildFetchProfileFailedPayload(
  err: unknown,
  isProduction: boolean
): FetchProfileFailedPayload {
  if (isProduction) {
    return { error: 'FETCH_PROFILE_FAILED' };
  }

  if (err instanceof SpotifyApiError) {
    return {
      error: 'FETCH_PROFILE_FAILED',
      reason: {
        status: err.status,
        code: err.code,
        message: err.message,
      },
    };
  }

  return {
    error: 'FETCH_PROFILE_FAILED',
    reason: {
      message: err instanceof Error ? err.message : String(err),
    },
  };
}

export function buildFetchProfileFailedLogMeta(err: unknown): Record<string, unknown> {
  if (err instanceof SpotifyApiError) {
    return {
      status: err.status,
      code: err.code,
      message: err.message,
      details: err.details,
    };
  }

  return {
    message: err instanceof Error ? err.message : String(err),
  };
}

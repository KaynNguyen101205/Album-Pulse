import 'server-only';

import { SpotifyOAuthError } from './oauth';
import { SpotifyApiError } from './types';

export type FetchProfileFailedPayload = {
  error: 'FETCH_PROFILE_FAILED';
  reason?: {
    status?: number;
    code?: string;
    message: string;
  };
};

export type TokenExchangeFailedPayload = {
  error: 'TOKEN_EXCHANGE_FAILED';
  reason?: {
    status?: number;
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

export function resolveFetchProfileFailedStatus(
  err: unknown,
  _isProduction: boolean
): number {
  if (err instanceof SpotifyApiError) {
    return err.status;
  }
  return 500;
}

export function buildTokenExchangeFailedPayload(
  err: unknown,
  isProduction: boolean
): TokenExchangeFailedPayload {
  if (isProduction) {
    return { error: 'TOKEN_EXCHANGE_FAILED' };
  }

  if (err instanceof SpotifyOAuthError) {
    return {
      error: 'TOKEN_EXCHANGE_FAILED',
      reason: {
        status: err.status,
        message: err.message,
      },
    };
  }

  return {
    error: 'TOKEN_EXCHANGE_FAILED',
    reason: {
      message: err instanceof Error ? err.message : String(err),
    },
  };
}

export function resolveTokenExchangeFailedStatus(
  err: unknown,
  isProduction: boolean
): number {
  if (isProduction) return 401;
  if (err instanceof SpotifyOAuthError) {
    return err.status;
  }
  return 401;
}

export function buildTokenExchangeFailedLogMeta(err: unknown): Record<string, unknown> {
  if (err instanceof SpotifyOAuthError) {
    return {
      status: err.status,
      message: err.message,
      details: err.details,
    };
  }

  return {
    message: err instanceof Error ? err.message : String(err),
  };
}

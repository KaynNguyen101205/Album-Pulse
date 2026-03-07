/**
 * Consistent error response shapes for all API routes.
 * All errors return: { error: { code, message, details? } }
 */

import { NextResponse } from 'next/server';

export type ApiErrorCode =
  | 'validation_error'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'bad_request'
  | 'internal_error'
  | 'upstream_error';

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
};

/**
 * Build a JSON error response with consistent shape.
 */
export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: unknown
): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = {
    error: { code, message, ...(details != null ? { details } : {}) },
  };
  return NextResponse.json(body, { status });
}

/** 400 Bad Request / invalid input */
export function badRequest(message: string, details?: unknown) {
  return apiError(400, 'bad_request', message, details);
}

/** 400 Validation failed (Zod or schema) */
export function validationError(message: string, details?: unknown) {
  return apiError(400, 'validation_error', message, details);
}

/** 401 Not logged in */
export function unauthorized(message = 'You must be logged in.') {
  return apiError(401, 'unauthorized', message);
}

/** 403 Forbidden (e.g. not owner) */
export function forbidden(message = 'You do not have access to this resource.') {
  return apiError(403, 'forbidden', message);
}

/** 404 Not found */
export function notFound(message = 'Resource not found.') {
  return apiError(404, 'not_found', message);
}

/** 409 Conflict / duplicate */
export function conflict(message: string, details?: unknown) {
  return apiError(409, 'conflict', message, details);
}

/** 500 Internal server error */
export function internalError(message = 'An unexpected error occurred.') {
  return apiError(500, 'internal_error', message);
}

/** 502/503 Upstream error */
export function upstreamError(status: 502 | 503, message: string, details?: unknown) {
  return apiError(status, 'upstream_error', message, details);
}

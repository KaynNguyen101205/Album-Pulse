/**
 * Helpers to parse request body/query/params with Zod and return consistent validation_error response on failure.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validationError } from '@/lib/api/errors';

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

/**
 * Parse and return either data or a 400 validation_error response.
 */
export function parseWithSchema<T>(
  schema: z.ZodType<T>,
  input: unknown,
  options?: { message?: string }
): ParseResult<T> {
  const result = schema.safeParse(input);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  const issues = result.error.flatten();
  const message = options?.message ?? 'Validation failed.';
  const details = {
    fieldErrors: issues.fieldErrors as Record<string, string[] | undefined>,
    formErrors: issues.formErrors,
  };
  return {
    ok: false,
    response: validationError(message, details),
  };
}

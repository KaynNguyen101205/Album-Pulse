import { describe, expect, it } from 'vitest';

import {
  decodeRunsCursor,
  encodeRunsCursor,
  InvalidCursorError,
  normalizeHistoryLimit,
} from './pagination';

describe('recommendation runs pagination', () => {
  it('normalizes history limit with default and bounds', () => {
    expect(normalizeHistoryLimit(undefined)).toBe(20);
    expect(normalizeHistoryLimit(Number.NaN)).toBe(20);
    expect(normalizeHistoryLimit(0)).toBe(1);
    expect(normalizeHistoryLimit(1)).toBe(1);
    expect(normalizeHistoryLimit(12.8)).toBe(12);
    expect(normalizeHistoryLimit(50)).toBe(50);
    expect(normalizeHistoryLimit(500)).toBe(50);
  });

  it('encodes and decodes cursor round-trip', () => {
    const cursor = encodeRunsCursor({
      createdAt: new Date('2026-03-04T12:34:56.000Z'),
      id: 'run_abc123',
    });

    const parsed = decodeRunsCursor(cursor);
    expect(parsed.id).toBe('run_abc123');
    expect(parsed.createdAt.toISOString()).toBe('2026-03-04T12:34:56.000Z');
  });

  it('throws InvalidCursorError for malformed cursor', () => {
    expect(() => decodeRunsCursor('bad-cursor')).toThrowError(InvalidCursorError);
  });
});

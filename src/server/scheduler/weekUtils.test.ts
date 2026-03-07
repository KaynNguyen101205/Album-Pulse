import { describe, it, expect } from 'vitest';
import {
  getWeekStartMondayUTC,
  getWeekKey,
  getCurrentWeekStartUTC,
  getFrozenUntil,
  parseWeekKey,
} from './weekUtils';

describe('weekUtils', () => {
  describe('getWeekStartMondayUTC', () => {
    it('returns Monday 00:00 UTC for a Monday', () => {
      const monday = new Date(Date.UTC(2026, 2, 2, 12, 30, 0)); // 2026-03-02 12:30 UTC
      const start = getWeekStartMondayUTC(monday);
      expect(start.getUTCDay()).toBe(1);
      expect(start.getUTCHours()).toBe(0);
      expect(start.getUTCMinutes()).toBe(0);
      expect(start.getUTCDate()).toBe(2);
      expect(start.getUTCMonth()).toBe(2);
    });

    it('returns previous Monday for a Wednesday', () => {
      const wed = new Date(Date.UTC(2026, 2, 4, 0, 0, 0)); // 2026-03-04
      const start = getWeekStartMondayUTC(wed);
      expect(start.getUTCDay()).toBe(1);
      expect(start.getUTCDate()).toBe(2);
      expect(start.getUTCMonth()).toBe(2);
    });

    it('returns the Monday that starts the week containing a Sunday', () => {
      const sun = new Date(Date.UTC(2026, 2, 1, 0, 0, 0)); // 2026-03-01 Sunday
      const start = getWeekStartMondayUTC(sun);
      expect(start.getUTCDay()).toBe(1);
      // That week started on the previous Monday, 2026-02-23
      expect(start.getUTCDate()).toBe(23);
      expect(start.getUTCMonth()).toBe(1);
    });
  });

  describe('getWeekKey', () => {
    it('returns YYYY-MM-DD for Monday', () => {
      const monday = new Date(Date.UTC(2026, 2, 2, 0, 0, 0));
      expect(getWeekKey(monday)).toBe('2026-03-02');
    });
  });

  describe('getFrozenUntil', () => {
    it('returns weekStart + 7 days', () => {
      const weekStart = new Date(Date.UTC(2026, 2, 2, 0, 0, 0));
      const end = getFrozenUntil(weekStart);
      expect(end.getUTCDate()).toBe(9);
      expect(end.getUTCMonth()).toBe(2);
      expect(end.getUTCFullYear()).toBe(2026);
    });

    it('freeze covers exactly 7 days from Monday', () => {
      const weekStart = new Date(Date.UTC(2026, 2, 2, 0, 0, 0));
      const frozenUntil = getFrozenUntil(weekStart);
      const diff = frozenUntil.getTime() - weekStart.getTime();
      expect(diff).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });

  describe('parseWeekKey', () => {
    it('parses YYYY-MM-DD to Monday 00:00 UTC', () => {
      const d = parseWeekKey('2026-03-02');
      expect(d.getUTCFullYear()).toBe(2026);
      expect(d.getUTCMonth()).toBe(2);
      expect(d.getUTCDate()).toBe(2);
      expect(d.getUTCHours()).toBe(0);
      expect(d.getUTCMinutes()).toBe(0);
    });
  });

  describe('7-day freeze behavior', () => {
    it('same week key for any day in the week', () => {
      const monday = new Date(Date.UTC(2026, 2, 2, 0, 0, 0));
      const friday = new Date(Date.UTC(2026, 2, 6, 15, 0, 0));
      const sunday = new Date(Date.UTC(2026, 2, 8, 23, 59, 0));
      expect(getWeekKey(getWeekStartMondayUTC(monday))).toBe('2026-03-02');
      expect(getWeekKey(getWeekStartMondayUTC(friday))).toBe('2026-03-02');
      expect(getWeekKey(getWeekStartMondayUTC(sunday))).toBe('2026-03-02');
    });
  });
});

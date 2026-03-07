import { describe, it, expect } from 'vitest';
import {
  searchQuerySchema,
  onboardingFavoritesBodySchema,
  weeklyDropFeedbackPatchSchema,
  analyticsEventBodySchema,
  paginationQuerySchema,
  weeklyDropHistoryQuerySchema,
  itemIdParamSchema,
} from './schemas';

describe('validation schemas', () => {
  describe('searchQuerySchema', () => {
    it('accepts valid q (min 2 chars)', () => {
      const r = searchQuerySchema.safeParse({ q: 'ab', limit: undefined });
      expect(r.success).toBe(true);
    });
    it('rejects q too short', () => {
      const r = searchQuerySchema.safeParse({ q: 'a' });
      expect(r.success).toBe(false);
    });
    it('rejects empty q', () => {
      const r = searchQuerySchema.safeParse({ q: '' });
      expect(r.success).toBe(false);
    });
  });

  describe('onboardingFavoritesBodySchema', () => {
    it('accepts minimal valid body', () => {
      const r = onboardingFavoritesBodySchema.safeParse({
        selectedAlbums: [{ title: 'T', artistName: 'A' }],
      });
      expect(r.success).toBe(true);
    });
    it('rejects empty selectedAlbums', () => {
      const r = onboardingFavoritesBodySchema.safeParse({ selectedAlbums: [] });
      expect(r.success).toBe(false);
    });
    it('rejects missing title', () => {
      const r = onboardingFavoritesBodySchema.safeParse({
        selectedAlbums: [{ artistName: 'A' }],
      });
      expect(r.success).toBe(false);
    });
  });

  describe('weeklyDropFeedbackPatchSchema', () => {
    it('accepts empty object', () => {
      const r = weeklyDropFeedbackPatchSchema.safeParse({});
      expect(r.success).toBe(true);
    });
    it('accepts rating 1-5', () => {
      const r = weeklyDropFeedbackPatchSchema.safeParse({ rating: 3 });
      expect(r.success).toBe(true);
    });
    it('rejects rating out of range', () => {
      expect(weeklyDropFeedbackPatchSchema.safeParse({ rating: 0 }).success).toBe(false);
      expect(weeklyDropFeedbackPatchSchema.safeParse({ rating: 6 }).success).toBe(false);
    });
  });

  describe('analyticsEventBodySchema', () => {
    it('accepts minimal event', () => {
      const r = analyticsEventBodySchema.safeParse({ eventName: 'view' });
      expect(r.success).toBe(true);
    });
    it('rejects empty eventName', () => {
      const r = analyticsEventBodySchema.safeParse({ eventName: '' });
      expect(r.success).toBe(false);
    });
  });

  describe('paginationQuerySchema', () => {
    it('defaults limit to 20', () => {
      const r = paginationQuerySchema.safeParse({});
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.limit).toBe(20);
    });
  });

  describe('weeklyDropHistoryQuerySchema', () => {
    it('accepts limit and cursor', () => {
      const r = weeklyDropHistoryQuerySchema.safeParse({ limit: '15', cursor: 'abc' });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.limit).toBe(15);
        expect(r.data.cursor).toBe('abc');
      }
    });
    it('rejects limit > 30', () => {
      const r = weeklyDropHistoryQuerySchema.safeParse({ limit: '50' });
      expect(r.success).toBe(false);
    });
  });

  describe('itemIdParamSchema', () => {
    it('accepts itemId', () => {
      const r = itemIdParamSchema.safeParse({ itemId: 'id-1' });
      expect(r.success).toBe(true);
    });
    it('rejects empty itemId', () => {
      const r = itemIdParamSchema.safeParse({ itemId: '' });
      expect(r.success).toBe(false);
    });
  });
});

/**
 * Zod schemas for API request validation.
 * Use with parseOrThrow or safeParse; return validation_error with details on failure.
 */

import { z } from 'zod';

// ----- Search -----
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 200;
const MAX_SEARCH_LIMIT = 50;

export const searchQuerySchema = z.object({
  q: z
    .string()
    .min(1, 'Query "q" is required.')
    .transform((s) => s.trim())
    .refine((s) => s.length >= MIN_QUERY_LENGTH, {
      message: `Query must be at least ${MIN_QUERY_LENGTH} characters.`,
    })
    .refine((s) => s.length <= MAX_QUERY_LENGTH, {
      message: `Query must be at most ${MAX_QUERY_LENGTH} characters.`,
    }),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Number.parseInt(v, 10) : undefined))
    .pipe(z.number().int().min(1).max(MAX_SEARCH_LIMIT).optional()),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

// ----- Onboarding favorites -----
export const onboardingAlbumItemSchema = z.object({
  source: z.enum(['search', 'manual']).optional().default('search'),
  mbid: z.string().trim().optional().nullable(),
  title: z.string().min(1, 'Title is required.').trim(),
  artistName: z.string().min(1, 'Artist name is required.').trim(),
  artistMbid: z.string().trim().optional().nullable(),
  releaseYear: z.number().int().min(1000).max(9999).optional().nullable(),
  coverUrl: z.string().max(2000).optional().nullable(),
});

export const onboardingFavoritesBodySchema = z.object({
  selectedAlbums: z
    .array(onboardingAlbumItemSchema)
    .min(1, 'At least one album is required.')
    .max(30, 'At most 30 albums allowed.'),
  preferredArtists: z.array(z.string().trim()).max(30).optional().default([]),
  preferredGenres: z.array(z.string().trim()).max(30).optional().default([]),
});

export type OnboardingFavoritesBody = z.infer<typeof onboardingFavoritesBodySchema>;

// ----- Pagination -----
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const paginationQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Number.parseInt(v, 10) : DEFAULT_LIMIT))
    .pipe(z.number().int().min(1).max(MAX_LIMIT)),
  cursor: z.string().trim().optional().nullable(),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

const HISTORY_MAX_LIMIT = 30;
export const weeklyDropHistoryQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? Number.parseInt(v, 10) : 10))
    .pipe(z.number().int().min(1).max(HISTORY_MAX_LIMIT)),
  cursor: z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined)),
});

export type WeeklyDropHistoryQuery = z.infer<typeof weeklyDropHistoryQuerySchema>;

// ----- Weekly drop feedback -----
export const weeklyDropFeedbackPatchSchema = z
  .object({
    liked: z.boolean().nullable().optional(),
    disliked: z.boolean().nullable().optional(),
    skipped: z.boolean().nullable().optional(),
    saved: z.boolean().nullable().optional(),
    rating: z.number().int().min(1).max(5).nullable().optional(),
    reviewText: z.string().max(4000).nullable().optional(),
    alreadyListened: z.boolean().nullable().optional(),
    listenedNotes: z.string().max(2000).nullable().optional(),
    notInterestedReason: z
      .enum([
        'NOT_MY_GENRE',
        'DONT_LIKE_ARTIST',
        'ALREADY_KNOW_ALBUM',
        'TOO_SIMILAR_RECENT',
        'MOOD_MISMATCH',
        'OTHER',
      ])
      .nullable()
      .optional(),
    notInterestedOtherText: z.string().max(500).nullable().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.notInterestedOtherText &&
      value.notInterestedReason !== 'OTHER'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['notInterestedOtherText'],
        message: 'Other reason text requires notInterestedReason=OTHER.',
      });
    }
  });

export type WeeklyDropFeedbackPatchInput = z.infer<typeof weeklyDropFeedbackPatchSchema>;

// ----- Events / analytics -----
export const analyticsEventBodySchema = z.object({
  eventName: z
    .string()
    .min(1, 'eventName is required.')
    .max(120, 'eventName is too long.')
    .trim(),
  weeklyDropId: z.string().trim().optional().nullable(),
  weeklyDropItemId: z.string().trim().optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

export type AnalyticsEventBody = z.infer<typeof analyticsEventBodySchema>;

// ----- Weekly metrics query -----
export const weeklyDropMetricsQuerySchema = z.object({
  weeks: z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? Number.parseInt(v, 10) : 8))
    .pipe(z.number().int().min(1).max(26)),
  userId: z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined)),
});

export type WeeklyDropMetricsQuery = z.infer<typeof weeklyDropMetricsQuerySchema>;

// ----- Params -----
export const itemIdParamSchema = z.object({
  itemId: z.string().min(1, 'itemId is required.'),
});

export const dropIdParamSchema = z.object({
  dropId: z.string().min(1, 'dropId is required.'),
});

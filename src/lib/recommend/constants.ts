/**
 * Recommendation time-range and source constants.
 * These mirror the legacy Prisma enums (TimeRangeSpotify, NguonGoiY) that were
 * removed in the schema pivot; kept as app-level constants so suggest/onboarding
 * and recommend service continue to type-check without those DB enums.
 */

export const TimeRangeSpotify = {
  SHORT_TERM: 'SHORT_TERM',
  MEDIUM_TERM: 'MEDIUM_TERM',
  LONG_TERM: 'LONG_TERM',
} as const;

export type TimeRangeSpotify = (typeof TimeRangeSpotify)[keyof typeof TimeRangeSpotify];

export const NguonGoiY = {
  TOP: 'TOP',
  RECENT: 'RECENT',
  MIX: 'MIX',
} as const;

export type NguonGoiY = (typeof NguonGoiY)[keyof typeof NguonGoiY];

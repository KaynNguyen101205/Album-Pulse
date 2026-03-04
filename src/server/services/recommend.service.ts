import 'server-only';

import { NguonGoiY, TimeRangeSpotify } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { rankRecommendations } from '@/lib/recommend/engine';
import { persistRecommendationSnapshot } from '@/lib/recommend/persist';
import { getSessionUserId } from '@/lib/session';
import {
  fetchCandidateAlbums,
  fetchRecentlyPlayed,
  fetchTopArtists,
  getValidAccessToken,
  NotLoggedInError,
} from '@/server/services/spotify.service';

type SpotifyTimeRange = 'short_term' | 'medium_term' | 'long_term';

export type GenerateRecommendationsInput = {
  timeRange?: TimeRangeSpotify;
  limit?: number;
  nguon?: NguonGoiY;
};

export type GenerateRecommendationsResult = {
  dotGoiYId: string;
  items: ReturnType<typeof rankRecommendations>;
};

function toSpotifyTimeRange(timeRange: TimeRangeSpotify): SpotifyTimeRange {
  if (timeRange === TimeRangeSpotify.SHORT_TERM) return 'short_term';
  if (timeRange === TimeRangeSpotify.LONG_TERM) return 'long_term';
  return 'medium_term';
}

function normalizeLimit(limit: number): number {
  const parsed = Number.isFinite(limit) ? Math.floor(limit) : 20;
  return Math.min(Math.max(parsed, 1), 100);
}

export async function generateAndPersistRecommendations(
  input: GenerateRecommendationsInput = {}
): Promise<GenerateRecommendationsResult> {
  const nguoiDungId = await getSessionUserId();
  if (!nguoiDungId) {
    throw new NotLoggedInError();
  }

  const userSettings = await prisma.caiDatNguoiDung.findUnique({
    where: { nguoiDungId },
    select: { soLuongGoiY: true },
  });

  const timeRange = input.timeRange ?? TimeRangeSpotify.MEDIUM_TERM;
  const defaultLimit = userSettings?.soLuongGoiY ?? 20;
  const limit = normalizeLimit(input.limit ?? defaultLimit);
  const accessToken = await getValidAccessToken();

  const topArtists = await fetchTopArtists(accessToken, toSpotifyTimeRange(timeRange));
  const recentByArtist = await fetchRecentlyPlayed(accessToken, 50);
  const recentlyPlayed = Object.entries(recentByArtist).map(([artistId, trackCount]) => ({
    artistId,
    trackCount,
  }));

  const topArtistIds = topArtists.map((artist) => artist.artistId).filter(Boolean);
  const candidateAlbums = await fetchCandidateAlbums(accessToken, topArtistIds, 20);

  const items = rankRecommendations(topArtists, recentlyPlayed, candidateAlbums, { limit });

  const snapshot = await persistRecommendationSnapshot({
    nguoiDungId,
    timeRange,
    nguon: input.nguon ?? NguonGoiY.MIX,
    items,
  });

  return {
    dotGoiYId: snapshot.dotGoiYId,
    items,
  };
}

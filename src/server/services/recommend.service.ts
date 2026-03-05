import 'server-only';

import { NguonGoiY, TimeRangeSpotify } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { rankRecommendations } from '@/lib/recommend/engine';
import {
  decodeRunsCursor,
  encodeRunsCursor,
  InvalidCursorError,
  normalizeHistoryLimit,
} from '@/lib/recommend/pagination';
import { persistRecommendationSnapshot } from '@/lib/recommend/persist';
import { getSessionUserId } from '@/lib/session';
import {
  findLatestRunByUser,
  findRunWithItemsById,
  listRunsByUser,
  type RecommendationRunSummaryRecord,
  type RecommendationRunWithItemsRecord,
} from '@/server/db/recommend.repo';
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

export type RecommendationRun = {
  id: string;
  createdAt: Date;
  timeRange: TimeRangeSpotify;
  nguon: NguonGoiY;
  ghiChu: string | null;
};

export type RecommendationRunItem = {
  id: string;
  dotGoiYId: string;
  albumId: string;
  viTri: number | null;
  diem: number;
  lyDo: string | null;
  createdAt: Date;
  album: {
    id: string;
    spotifyId: string;
    ten: string;
    anhBiaUrl: string | null;
    spotifyUrl: string | null;
    ngayPhatHanh: string | null;
  };
};

export type RecommendationRunWithItems = {
  run: RecommendationRun;
  items: RecommendationRunItem[];
};

export type RecommendationRunSummary = RecommendationRun & {
  itemCount: number;
};

export type GetRecommendationRunsHistoryInput = {
  limit?: number;
  cursor?: string | null;
};

export type GetRecommendationRunsHistoryResult = {
  runs: RecommendationRunSummary[];
  nextCursor: string | null;
};

export class RecommendationRunNotFoundError extends Error {
  constructor(message = 'Recommendation run not found.') {
    super(message);
    this.name = 'RecommendationRunNotFoundError';
  }
}

function mapRun(record: RecommendationRunWithItemsRecord): RecommendationRun {
  return {
    id: record.id,
    createdAt: record.createdAt,
    timeRange: record.timeRange,
    nguon: record.nguon,
    ghiChu: record.ghiChu ?? null,
  };
}

function mapRunWithItems(record: RecommendationRunWithItemsRecord): RecommendationRunWithItems {
  return {
    run: mapRun(record),
    items: record.items.map((item) => ({
      id: item.id,
      dotGoiYId: item.dotGoiYId,
      albumId: item.albumId,
      viTri: item.viTri ?? null,
      diem: item.diem,
      lyDo: item.lyDo ?? null,
      createdAt: item.createdAt,
      album: {
        id: item.album.id,
        spotifyId: item.album.spotifyId,
        ten: item.album.ten,
        anhBiaUrl: item.album.anhBiaUrl ?? null,
        spotifyUrl: item.album.spotifyUrl ?? null,
        ngayPhatHanh: item.album.ngayPhatHanh ?? null,
      },
    })),
  };
}

function mapRunSummary(record: RecommendationRunSummaryRecord): RecommendationRunSummary {
  return {
    id: record.id,
    createdAt: record.createdAt,
    timeRange: record.timeRange,
    nguon: record.nguon,
    ghiChu: record.ghiChu ?? null,
    itemCount: record._count.items,
  };
}

function toSpotifyTimeRange(timeRange: TimeRangeSpotify): SpotifyTimeRange {
  if (timeRange === TimeRangeSpotify.SHORT_TERM) return 'short_term';
  if (timeRange === TimeRangeSpotify.LONG_TERM) return 'long_term';
  return 'medium_term';
}

function normalizeGenerateLimit(limit: number): number {
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
  const limit = normalizeGenerateLimit(input.limit ?? defaultLimit);
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

export async function getLatestRecommendationRun(): Promise<RecommendationRunWithItems | null> {
  const nguoiDungId = await getSessionUserId();
  if (!nguoiDungId) {
    throw new NotLoggedInError();
  }

  const latestRun = await findLatestRunByUser(nguoiDungId);
  if (!latestRun) return null;

  return mapRunWithItems(latestRun);
}

export async function getRecommendationRunById(
  runId: string
): Promise<RecommendationRunWithItems> {
  const nguoiDungId = await getSessionUserId();
  if (!nguoiDungId) {
    throw new NotLoggedInError();
  }

  const run = await findRunWithItemsById(nguoiDungId, runId);
  if (!run) {
    throw new RecommendationRunNotFoundError();
  }

  return mapRunWithItems(run);
}

export async function getRecommendationRunsHistory(
  input: GetRecommendationRunsHistoryInput = {}
): Promise<GetRecommendationRunsHistoryResult> {
  const nguoiDungId = await getSessionUserId();
  if (!nguoiDungId) {
    throw new NotLoggedInError();
  }

  const limit = normalizeHistoryLimit(input.limit);
  const cursorData = input.cursor ? decodeRunsCursor(input.cursor) : null;

  const records = await listRunsByUser(nguoiDungId, {
    limit: limit + 1,
    cursorCreatedAt: cursorData?.createdAt ?? null,
    cursorId: cursorData?.id ?? null,
  });

  const hasMore = records.length > limit;
  const page = hasMore ? records.slice(0, limit) : records;

  const nextCursor =
    hasMore && page.length > 0
      ? encodeRunsCursor({
          createdAt: page[page.length - 1].createdAt,
          id: page[page.length - 1].id,
        })
      : null;

  return {
    runs: page.map(mapRunSummary),
    nextCursor,
  };
}

export { InvalidCursorError };

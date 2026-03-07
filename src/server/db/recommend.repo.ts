import 'server-only';

import type { NguonGoiY, TimeRangeSpotify } from '@/lib/recommend/constants';

/**
 * Stub types for recommendation runs. The real tables (DotGoiY, GoiYAlbum, etc.)
 * were removed in the schema pivot; these types keep the recommend service
 * type-checking while all queries return empty/null.
 */

export type RecommendationRunWithItemsRecord = {
  id: string;
  nguoiDungId: string;
  createdAt: Date;
  timeRange: TimeRangeSpotify;
  nguon: NguonGoiY;
  ghiChu: string | null;
  items: Array<{
    id: string;
    dotGoiYId: string;
    albumId: string;
    diem: number;
    lyDo: string | null;
    viTri: number | null;
    createdAt: Date;
    album: {
      id: string;
      spotifyId: string;
      ten: string;
      anhBiaUrl: string | null;
      spotifyUrl: string | null;
      ngayPhatHanh: string | null;
    };
  }>;
};

export type RecommendationRunSummaryRecord = {
  id: string;
  nguoiDungId: string;
  createdAt: Date;
  timeRange: TimeRangeSpotify;
  nguon: NguonGoiY;
  ghiChu: string | null;
  _count: { items: number };
};

export type ListRunsByUserInput = {
  limit: number;
  cursorCreatedAt?: Date | null;
  cursorId?: string | null;
};

/** Stub: no persistence; always returns null. */
export async function findLatestRunByUser(
  _nguoiDungId: string
): Promise<RecommendationRunWithItemsRecord | null> {
  return null;
}

/** Stub: no persistence; always returns empty list. */
export async function listRunsByUser(
  _nguoiDungId: string,
  _input: ListRunsByUserInput
): Promise<RecommendationRunSummaryRecord[]> {
  return [];
}

/** Stub: no persistence; always returns null. */
export async function findRunWithItemsById(
  _nguoiDungId: string,
  _runId: string
): Promise<RecommendationRunWithItemsRecord | null> {
  return null;
}

/** Stub: always returns 0. */
export async function countRunItems(_dotGoiYId: string): Promise<number> {
  return 0;
}

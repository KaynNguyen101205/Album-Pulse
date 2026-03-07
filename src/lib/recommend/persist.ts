import 'server-only';

import { NguonGoiY, type TimeRangeSpotify } from '@/lib/recommend/constants';
import type { RecommendedAlbum } from '@/types/domain';

export type PersistRecommendationSnapshotInput = {
  nguoiDungId: string;
  timeRange: TimeRangeSpotify;
  items: RecommendedAlbum[];
  nguon?: NguonGoiY;
  ghiChu?: string | null;
};

export type PersistRecommendationSnapshotResult = {
  dotGoiYId: string;
  createdAt: Date;
  itemCount: number;
};

/**
 * Stub: recommendation persistence tables (DotGoiY, GoiYAlbum, etc.) were removed
 * in the schema pivot. Returns a mock result so the suggest API still returns
 * in-memory recommendations without persisting.
 */
export async function persistRecommendationSnapshot(
  input: PersistRecommendationSnapshotInput
): Promise<PersistRecommendationSnapshotResult> {
  const now = new Date();
  return {
    dotGoiYId: crypto.randomUUID(),
    createdAt: now,
    itemCount: input.items.length,
  };
}

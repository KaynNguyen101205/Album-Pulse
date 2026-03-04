import 'server-only';

import { NguonGoiY, type TimeRangeSpotify } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import type { RecommendedAlbum } from '@/types/domain';
import {
  createDotGoiY,
  createGoiYAlbums,
  upsertAlbumBySpotifyId,
  upsertAlbumNgheSiLink,
  upsertNgheSiBySpotifyId,
} from '@/server/db/recommend.repo';

export type PersistRecommendationSnapshotInput = {
  nguoiDungId: string;
  timeRange: TimeRangeSpotify;
  items: RecommendedAlbum[];
  nguon?: NguonGoiY;
  ghiChu?: string | null;
};

export type PersistRecommendationSnapshotResult = {
  dotGoiYId: string;
  itemCount: number;
};

export async function persistRecommendationSnapshot(
  input: PersistRecommendationSnapshotInput
): Promise<PersistRecommendationSnapshotResult> {
  return prisma.$transaction(async (tx) => {
    const dotGoiY = await createDotGoiY(tx, {
      nguoiDungId: input.nguoiDungId,
      timeRange: input.timeRange,
      nguon: input.nguon ?? NguonGoiY.MIX,
      ghiChu: input.ghiChu ?? null,
    });

    const goiYAlbumsToCreate: Array<{
      dotGoiYId: string;
      albumId: string;
      diem: number;
      lyDo: string;
      viTri: number;
    }> = [];
    const seenAlbumIds = new Set<string>();

    for (const item of input.items) {
      const albumRecord = await upsertAlbumBySpotifyId(tx, item.album);

      if (!seenAlbumIds.has(albumRecord.id)) {
        seenAlbumIds.add(albumRecord.id);
        goiYAlbumsToCreate.push({
          dotGoiYId: dotGoiY.id,
          albumId: albumRecord.id,
          diem: item.score,
          lyDo: item.lyDo,
          viTri: item.viTri,
        });
      }

      if (item.album.artistId) {
        const ngheSiRecord = await upsertNgheSiBySpotifyId(tx, {
          spotifyId: item.album.artistId,
          ten: item.album.artistName?.trim() || 'Unknown artist',
        });

        await upsertAlbumNgheSiLink(tx, {
          albumId: albumRecord.id,
          ngheSiId: ngheSiRecord.id,
          viTri: 1,
        });
      }
    }

    await createGoiYAlbums(tx, goiYAlbumsToCreate);

    return {
      dotGoiYId: dotGoiY.id,
      itemCount: goiYAlbumsToCreate.length,
    };
  });
}

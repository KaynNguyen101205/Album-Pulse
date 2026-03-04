import 'server-only';

import {
  Prisma,
  type DoChinhXacNgayPhatHanh,
  type NguonGoiY,
  type TimeRangeSpotify,
} from '@prisma/client';

import { prisma } from '@/lib/prisma';
import type { Album } from '@/types/domain';

type TxClient = Prisma.TransactionClient;

const runItemSelect = Prisma.validator<Prisma.GoiYAlbumSelect>()({
  id: true,
  dotGoiYId: true,
  albumId: true,
  diem: true,
  lyDo: true,
  viTri: true,
  createdAt: true,
  album: {
    select: {
      id: true,
      spotifyId: true,
      ten: true,
      anhBiaUrl: true,
      spotifyUrl: true,
      ngayPhatHanh: true,
    },
  },
});

const runWithItemsSelect = Prisma.validator<Prisma.DotGoiYSelect>()({
  id: true,
  nguoiDungId: true,
  createdAt: true,
  timeRange: true,
  nguon: true,
  ghiChu: true,
  items: {
    select: runItemSelect,
    orderBy: [{ viTri: 'asc' }, { id: 'asc' }],
  },
});

const runSummarySelect = Prisma.validator<Prisma.DotGoiYSelect>()({
  id: true,
  nguoiDungId: true,
  createdAt: true,
  timeRange: true,
  nguon: true,
  ghiChu: true,
  _count: {
    select: {
      items: true,
    },
  },
});

export type RecommendationRunWithItemsRecord = Prisma.DotGoiYGetPayload<{
  select: typeof runWithItemsSelect;
}>;

export type RecommendationRunSummaryRecord = Prisma.DotGoiYGetPayload<{
  select: typeof runSummarySelect;
}>;

export type ListRunsByUserInput = {
  limit: number;
  cursorCreatedAt?: Date | null;
  cursorId?: string | null;
};

function inferReleaseDatePrecision(releaseDate?: string | null): DoChinhXacNgayPhatHanh | null {
  if (!releaseDate) return null;
  if (/^\d{4}$/.test(releaseDate)) return 'YEAR';
  if (/^\d{4}-\d{2}$/.test(releaseDate)) return 'MONTH';
  if (/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) return 'DAY';
  return null;
}

function pickCoverUrl(album: Album): string | null {
  if (!album.images || album.images.length === 0) return null;
  const sorted = [...album.images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return sorted[0]?.url ?? null;
}

export async function upsertNgheSiBySpotifyId(
  tx: TxClient,
  input: {
    spotifyId: string;
    ten: string;
    anhUrl?: string | null;
  }
): Promise<{ id: string }> {
  return tx.ngheSi.upsert({
    where: { spotifyId: input.spotifyId },
    create: {
      spotifyId: input.spotifyId,
      ten: input.ten,
      anhUrl: input.anhUrl ?? null,
    },
    update: {
      ten: input.ten,
      anhUrl: input.anhUrl ?? null,
    },
    select: { id: true },
  });
}

export async function upsertAlbumBySpotifyId(
  tx: TxClient,
  album: Album
): Promise<{ id: string; spotifyId: string }> {
  const spotifyId = album.spotifyId || album.id;
  const releaseDate = album.releaseDate?.trim() ? album.releaseDate.trim() : null;
  const doChinhXacNgay = inferReleaseDatePrecision(releaseDate);
  const anhBiaUrl = pickCoverUrl(album);

  return tx.album.upsert({
    where: { spotifyId },
    create: {
      spotifyId,
      ten: album.name,
      ngayPhatHanh: releaseDate,
      doChinhXacNgay,
      anhBiaUrl,
      spotifyUrl: album.spotifyUrl ?? null,
    },
    update: {
      ten: album.name,
      ngayPhatHanh: releaseDate,
      doChinhXacNgay,
      anhBiaUrl,
      spotifyUrl: album.spotifyUrl ?? null,
    },
    select: {
      id: true,
      spotifyId: true,
    },
  });
}

export async function upsertAlbumNgheSiLink(
  tx: TxClient,
  input: {
    albumId: string;
    ngheSiId: string;
    viTri?: number | null;
  }
): Promise<void> {
  await tx.albumNgheSi.upsert({
    where: {
      albumId_ngheSiId: {
        albumId: input.albumId,
        ngheSiId: input.ngheSiId,
      },
    },
    create: {
      albumId: input.albumId,
      ngheSiId: input.ngheSiId,
      viTri: input.viTri ?? null,
    },
    update: {
      viTri: input.viTri ?? null,
    },
  });
}

export async function createDotGoiY(
  tx: TxClient,
  input: {
    nguoiDungId: string;
    timeRange: TimeRangeSpotify;
    nguon: NguonGoiY;
    ghiChu?: string | null;
  }
): Promise<{ id: string; createdAt: Date }> {
  return tx.dotGoiY.create({
    data: {
      nguoiDungId: input.nguoiDungId,
      timeRange: input.timeRange,
      nguon: input.nguon,
      ghiChu: input.ghiChu ?? null,
    },
    select: { id: true, createdAt: true },
  });
}

export async function createGoiYAlbums(
  tx: TxClient,
  input: Array<{
    dotGoiYId: string;
    albumId: string;
    diem: number;
    lyDo: string;
    viTri: number;
  }>
): Promise<void> {
  if (input.length === 0) return;

  await tx.goiYAlbum.createMany({
    data: input,
  });
}

export async function findLatestRunByUser(
  nguoiDungId: string
): Promise<RecommendationRunWithItemsRecord | null> {
  return prisma.dotGoiY.findFirst({
    where: { nguoiDungId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: runWithItemsSelect,
  });
}

export async function listRunsByUser(
  nguoiDungId: string,
  input: ListRunsByUserInput
): Promise<RecommendationRunSummaryRecord[]> {
  const { limit, cursorCreatedAt, cursorId } = input;
  const hasCursor = cursorCreatedAt instanceof Date && typeof cursorId === 'string' && cursorId.length > 0;

  return prisma.dotGoiY.findMany({
    where: {
      nguoiDungId,
      ...(hasCursor
        ? {
            OR: [
              { createdAt: { lt: cursorCreatedAt } },
              { createdAt: cursorCreatedAt, id: { lt: cursorId! } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
    select: runSummarySelect,
  });
}

export async function findRunWithItemsById(
  nguoiDungId: string,
  runId: string
): Promise<RecommendationRunWithItemsRecord | null> {
  return prisma.dotGoiY.findFirst({
    where: {
      id: runId,
      nguoiDungId,
    },
    select: runWithItemsSelect,
  });
}

export async function countRunItems(dotGoiYId: string): Promise<number> {
  return prisma.goiYAlbum.count({
    where: { dotGoiYId },
  });
}
